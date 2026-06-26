import Razorpay from 'razorpay';
import crypto from 'crypto';
import logger from '../utils/logger.js';

// create razorpay order
// This generates a UPI QR code that the machine screen displays.
// amount is in PAISE (multiply rupees × 100)
export const createRazorpayOrder = async ({ amount, receipt, notes }) => {

    // Lazy-initialize: create client here so server doesn't crash if keys are

    const razorpay = new Razorpay({
        key_id:     process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const options = {
        amount: Math.round(amount * 100),
        currency: "INR",
        receipt,
        payment_capture: 1,
        notes,
    };

    const razorpayOrder = await razorpay.orders.create(options);

    logger.info({ razorpay_order_id: razorpayOrder.id, amount }, "Razorpay order created");

    return razorpayOrder;
};

// verify webhook signature given by razorpay
export const verifyWebhookSignature = (rawBody, signature) => {
    const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(rawBody)
        .digest("hex");

    return expectedSignature === signature;
};
