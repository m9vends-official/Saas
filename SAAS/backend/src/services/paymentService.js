import Razorpay from 'razorpay'
import crypto from 'crypto'
import logger from '../utils/logger.js'

// initialize razorpay client
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// create razorpay order
// This generates a UPI QR code that the machine screen displays.
// amount is in PAISE (multiply rupees × 100)

export const createRazorpayOrder = async ({amount,receipt,notes}) => {
    const options = {
        amount: Math.rount(amount*100),
        currency: "IND",
        receipt,
        payment_capture,
        notes,
    };

    const razorpayOrder = await razorpay.orders.create(options);

    logger.info({razorpay_order_id: razorpayOrder.id, amount}, "Razorpay order crested");

    return razorpayOrder;
}

// verity webhook signature
// verify signature given by razorpay
export const verifyWebhookSignature = (rawBody, signature) => {
    const expectedSignature = crypto.createHmac("sha256",process.env.RAZORPAY_KEY_SECRET)
    .update(rawBody)
    .digest("hex");

    return expectedSignature === signature;
};
