import Device from '../models/Device.js'
import MachineCatalog from '../models/MachineCatalog.js'
import Order from '../models/Order.js'
import ApiError from '../utils/ApiError.js'
import logger from '../utils/logger.js'


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
    
}