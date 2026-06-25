import { getOrderStatus, markOrderPaid, placeOrder } from "../../../services/orderService.js"; // FIX: missing .js extension
import { verifyWebhookSignature } from "../../../services/paymentService.js";                  // FIX: missing .js extension
import ApiError from "../../../utils/ApiError.js";                                              // FIX: missing .js extension
import logger from "../../../utils/logger.js";                                                  // FIX: logger was used but never imported


// POST /api/public/order
// Machine screen calls this when customer confirms cart
export const createOrder = async (req, res, next) => {
    try {
        const { machine_id, items } = req.body;

        const result = await placeOrder({ machine_id, items });

        res.status(201).json({
            success: true,
            data:    result,
        });
    } catch (error) {
        next(error);
    }
};

// GET /api/public/order/:id/status
// Machine screen polls this every 2–3 seconds to check if customer paid
export const checkOrderStatus = async (req, res, next) => {
    try {
        const order = await getOrderStatus(req.params.id);

        res.json({
            success: true,
            order_id: order._id,
            payment_status: order.payment_status, 
            order_status: order.order_status,
            total_amount: order.total_amount,
            paid_at: order.paid_at,
        });
    } catch (error) {
        next(error);
    }
};

// POST /api/public/payment/webhook
// Razorpay calls this when payment is confirmed
// Must use raw body (not JSON parsed) for signature verification
export const handleWebhook = async (req, res, next) => {
    try {
        const signature = req.headers["x-razorpay-signature"];

        if (!signature) {
            throw ApiError.badRequest("Missing webhook signature");
        }

        const isValid = verifyWebhookSignature(req.rawBody, signature);
        if (!isValid) {
            logger.warn("Invalid Razorpay webhook signature — possible spoofing attempt");
            throw ApiError.unauthorized("Invalid webhook signature");
        }

        const event = req.body;

        if (event.event === "payment.captured") {
            const {
                order_id: razorpay_order_id, 
                id:       razorpay_payment_id,
            } = event.payload.payment.entity;

            await markOrderPaid({ razorpay_order_id, razorpay_payment_id });
        }

        // Always return 200 to Razorpay — even for unhandled events
        res.json({ success: true }); 

    } catch (error) {
        next(error);
    }
};
