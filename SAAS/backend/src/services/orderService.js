import mongoose from 'mongoose';
import MachineCatalog from '../models/MachineCatalog.js'
import Order from '../models/Order.js'
import ApiError from '../utils/ApiError.js'
import logger from '../utils/logger.js'
import {createRazorpayOrder} from './paymentService.js'

// ─── Shared helper: decrement stock for every item in a paid order ────────────
// Called after BOTH UPI (webhook) and CASH (admin confirm) payment confirmation.
// Uses bulkWrite for a single round-trip. The stock >= quantity guard prevents
// going below 0 if something was restocked/adjusted between order placement and payment.
const decrementStock = async (order) => {
    if (!order?.items?.length) return;

    const ops = order.items.map(item => ({
        updateOne: {
            filter: {
                _id:     item.catalog_id,
                stock:   { $gte: item.quantity }, // safety: only decrement if stock is sufficient
            },
            update: { $inc: { stock: -item.quantity } },
        },
    }));

    const result = await MachineCatalog.bulkWrite(ops, { ordered: false });

    // Warn if any item couldn't be decremented (e.g. already at 0 — edge case)
    const missed = ops.length - result.modifiedCount;
    if (missed > 0) {
        logger.warn(
            { order_id: order._id, missed_items: missed },
            'Stock decrement: some catalog entries could not be decremented — stock may already be 0'
        );
    }

    logger.info(
        { order_id: order._id, items_decremented: result.modifiedCount },
        'Stock decremented after payment'
    );
};


export const placeOrder = async ({machine_id, items, payment_method = 'UPI'}) => {

    const normalizedMachineId = machine_id;

    // validate each item and calculate total price
    const resolvedItems = [];
    let total_amount = 0;
    let company_id = null;

    for(const item of items){
        // Guard: catalog_id must be a valid MongoDB ObjectId — fail fast with a clear 400
        // instead of crashing with a CastError 500 when mock/invalid IDs are sent
        if (!mongoose.isValidObjectId(item.catalog_id)) {
            throw ApiError.badRequest(
                `Invalid catalog_id '${item.catalog_id}'. Must be a valid MongoDB ObjectId from GET /api/public/catalog/:machine_id`
            );
        }

        const entry = await MachineCatalog.findOne({
            _id: item.catalog_id,
            machine_id: normalizedMachineId,
            is_enabled: true,
        }).populate("product_id", "product_name price is_available");

        if(!entry){
            throw ApiError.badRequest(`Catalog item '${item.catalog_id}' not found or disabled`)
        }
        if(!entry.product_id || !entry.product_id.is_available){
            throw ApiError.badRequest(`'${entry.product_id?.product_name || "Product"}' is not available`);
        }
        if(entry.stock < item.quantity){
            throw ApiError.badRequest(`Insufficient stock for '${entry.product_id.product_name}'. Available: ${entry.stock}`);
        }

        if (!company_id) {
            company_id = entry.company_id;
        }

        // use machine price override if set, otherwise product price
        const unit_price = entry.price_override ?? entry.product_id.price;
        const subtotal = unit_price * item.quantity;

        resolvedItems.push({
            catalog_id: entry._id,
            product_id: entry.product_id._id,
            product_name: entry.product_id.product_name,
            quantity: item.quantity,
            unit_price,
            subtotal,
        });

        total_amount += subtotal;
    }

    if (!company_id) {
        throw ApiError.badRequest("Order cannot be created: company information missing from catalog");
    }

    // Create Order document (PENDING)
    const order = await Order.create({
        company_id,
        machine_id: normalizedMachineId,
        items: resolvedItems,
        total_amount,
        payment_method,
    });

    // CASH: skip Razorpay — admin confirms manually in dashboard
    if (payment_method === 'CASH') {
        logger.info({ order_id: order._id, machine_id: normalizedMachineId, total_amount, payment_method }, 'Cash order placed');
        return {
            order_id:       order._id,
            total_amount,
            items:          resolvedItems,
            payment_method: 'CASH',
        };
    }

    // UPI: create Razorpay order -> get payment link for QR code
    const razorpayOrder = await createRazorpayOrder({
        amount: total_amount,
        receipt: order._id.toString(),
        notes: {
            machine_id: normalizedMachineId,
            order_id:   order._id.toString(),
        },
    });

    const payment_link = `upi://pay?pa=MERCHANT_UPI_ID&pn=M9Vends&tr=${razorpayOrder.id}&am=${total_amount}&cu=INR`;

    order.razorpay_order_id = razorpayOrder.id;
    order.payment_link      = payment_link;
    await order.save();

    logger.info({ order_id: order._id, machine_id: normalizedMachineId, total_amount, payment_method }, 'UPI order placed');

    return {
        order_id:          order._id,
        razorpay_order_id: razorpayOrder.id,
        total_amount,
        items:             resolvedItems,
        payment_link,
        currency:          'INR',
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

// ─── Handle Webhook — Mark Order as PAID (UPI)
// Called internally from the webhook controller after signature is verified.
export const markOrderPaid = async ({razorpay_order_id, razorpay_payment_id}) => {
    const order = await Order.findOneAndUpdate(
        {
            razorpay_order_id,
            payment_status: 'PENDING',
        },
        {
            payment_status:      'PAID',
            order_status:        'DISPENSING',
            razorpay_payment_id,
            paid_at:             new Date(),
        },
        { new: true }
    );

    if (!order) {
        logger.warn({ razorpay_order_id }, 'Webhook received for unknown or already-processed order');
        return null;
    }

    logger.info({ order_id: order._id, razorpay_order_id }, 'UPI order marked as paid');

    // ✅ Decrement stock for every item in this order
    await decrementStock(order);

    return order;
};

// list orders (ADMIN)

export const getCompanyOrders = async ({company_id, machine_id, status, page=1, limit=20}) => {
    const filter = {company_id};
    if(machine_id) filter.machine_id = machine_id;
    if(status) filter.payment_status = status;

    const skip = (page-1)*limit;
    const orders = await Order.find(filter).sort({createdAt: -1}).skip(skip).limit(limit);

    const total = await Order.countDocuments(filter);

    return {orders, total, page, limit};
}

// Confirm Cash Payment 
// Called by admin when customer physically pays cash at the machine.
// No Razorpay involved — admin manually confirms the payment.

export const confirmCashPayment = async ({company_id, orderId, collected_by}) => {
    const order = await Order.findOneAndUpdate(
        {
            _id:            orderId,
            company_id,
            payment_status: 'PENDING',
        },
        {
            payment_status: 'PAID',
            order_status:   'DISPENSING',
            payment_method: 'CASH',
            paid_at:        new Date(),
        },
        { new: true }
    );

    if (!order) {
        throw ApiError.notFound('Order not found, already paid, or does not belong to your company');
    }

    logger.info(
        { order_id: order._id, machine_id: order.machine_id, collected_by },
        'Cash payment confirmed by admin'
    );

    // ✅ Decrement stock for every item in this order
    await decrementStock(order);

    return order;
}

// ─── Cancel Order (PUBLIC)
// Called by kiosk when UPI timer expires or customer cancels.
// Only cancels orders that are still PENDING.
export const cancelOrder = async (orderId) => {
    const order = await Order.findOneAndUpdate(
        { _id: orderId, payment_status: 'PENDING' },
        { payment_status: 'FAILED', order_status: 'CANCELLED' },
        { new: true }
    );

    if (!order) {
        throw ApiError.badRequest('Order cannot be cancelled — not found or already processed');
    }

    logger.info({ order_id: order._id }, 'Order cancelled by kiosk');
    return order;
};