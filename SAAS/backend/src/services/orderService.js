import Device from '../models/Device.js'
import MachineCatalog from '../models/MachineCatalog.js'
import Order from '../models/Order.js'
import ApiError from '../utils/ApiError.js'
import logger from '../utils/logger.js'
import {createRazorpayOrder} from './paymentService.js'


export const placeOrder = async ({machine_id, items}) => {

    const normalizedMachineId = machine_id.toUpperCase();

    // verify machine exists and is active
    const device = await Device.findOne({device_id :normalizedMachineId});
    if(!device){
        throw ApiError.notFound(`Machine '${machine_id}' not found `)
    }
    if(device.status!== "ACTIVE"){
        throw ApiError.badRequest(`Machine is currently unavailable`)
    }

    // validate each item and calculate total price
    const resolvedItems = [];
    let total_amount = 0;

    for(const item of items){
        const entry = await MachineCatalog.findOne({
            _id: item.catalog_id,
            machine_id: normalizedMachineId,
            is_enabled: true,
        }).populate("product_id", "product_name price is_available");

        if(!entry){
            throw ApiError.badRequest(`Catalog item '${item.catalog_id}' not found or disabled`)
        }
        if(!entry.product_id.is_available){
            throw ApiError.badRequest(`'${entry.product_id.product_name}' is not available`);
        }
        if(entry.stock < item.quantity){
            throw ApiError.badRequest(`Insufficient stock for '${entry.product_id.product_name}'. Available: ${entry.stock}`);
        }

        // use machine price override if set, otherwise product price
        const unit_price = entry.price_override ?? entry.product_id.price;
        const subtotal = unit_price* item.quantity;

        resolvedItems.push({
            catalog_id: entry_id,
            product_id: entry.product_id._id,
            product_name: entry.product_id.product_name,
            quantity: item.quantity,
            unit_price,
            subtotal,
        });

        total_amount += subtotal;
    }

    // create our Order document first(PENDING)
    const order = await Order.create({
        company_id: device.company_id,
        machine_id: normalizedMachineId,
        items: resolvedItems,
        total_amount,
    });

    // create razorpay payment order -> get QR code
    const razorpayOrder = await createRazorpayOrder({
        amount: total_amount,
        receipt: order._id.toString(),
        notes: {
            machine_id: normalizedMachineId,
            order_id: order._id.toString(),
        },
    });

    // 5. Build the UPI payment link (this is what becomes the QR code on screen)
    // The machine screen should render this as a QR code using a QR library
    const payment_link = `upi://pay?pa=MERCHANT_UPI_ID&pn=M9Vends&tr=${razorpayOrder.id}&am=${total_amount}&cu=INR`;

    // save razorpay details back to our order
    order.razorpay_order_id = razorpayOrder.id;
    order.payment_link = payment_link;
    await order.save();

    logger.info({ order_id: order._id, machine_id: normalizedMachineId, total_amount }, "Order placed");

    return {
    order_id: order._id,
    razorpay_order_id: razorpayOrder.id,
    total_amount,
    items: resolvedItems,
    payment_link,      // Machine screen renders this as QR code
    currency: "INR",
  };
};

// ─── Get Order Status 
// Machine screen polls this every 2–3 seconds to know if payment is done.
export const getOrderStatus = async (orderId) => {
    const order = await Order.findById(orderId).select(
        "payment_status order_status total_amount machine_id paid_at"
    )
    if(!order) throw ApiError.notFound("Order not Found");
    return order;
}

// ─── Handle Webhook — Mark Order as PAID 
// Called internally from the webhook controller after signature is verified.
export const markOrderPaid = async ({razorpay_order_id, razorpay_payment}) => {
    const order = await Order.findOneAndUpdate(
        {razorpay_order_id, payment_status: "PENDING"},
        {
            payment_status: "PAID",
            order_status: "DISPENSING",
            razorpay_payment_id,
            paid_at: new Date(),
        },
        {new: true}
    )

    if (!order) {
    logger.warn({ razorpay_order_id }, "Webhook received for unknown or already-processed order");
    return null;
    }
}

// list orders (ADMIN)

export const getCompanyOrders = async ({company_id, machine_id, status, page=1, limit=20}) => {
    const filter = {company_id};
    if(machine_id) filter.machine_id = machine_id.toUpperCase();
    if(status) filter.payment_status = status;

    const skip = (page-1)*limit;
    const orders = await Order.find(filter).sort({createdAt: -1}).skip(skip).limit(limit);

    const total = await Order.countDocuments(filter);

    return {orders, total, page, limit};
}
