import { placeOrder } from "../../../services/orderService";


// ─── POST /api/public/order
// Machine screen calls this when customer confirms cart
export const createOrder = async (req, res, next) => {
    try {
        const {machine_id, items} = req.body;

        const res = await placeOrder({machine_id, items});

        res.status(201).json({
            success: true,
            data: res,
        });
    } catch (error) {
        next(error);
    }
}

