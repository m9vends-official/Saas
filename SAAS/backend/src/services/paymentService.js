import Razorpay from 'razorpay';
import crypto from 'crypto';
import logger from '../utils/logger.js';
import Company from '../models/Company.js';
import ApiError from '../utils/ApiError.js';

// create razorpay payment link (which acts as an order)
// amount is in PAISE (multiply rupees × 100)
export const createRazorpayOrder = async ({ amount, receipt, notes, company_id }) => {
    
    let key_id = process.env.RAZORPAY_KEY_ID;
    let key_secret = process.env.RAZORPAY_KEY_SECRET;

    if (company_id) {
        const company = await Company.findById(company_id);
        if (company && company.razorpay_key_id && company.razorpay_key_secret) {
            key_id = company.razorpay_key_id;
            key_secret = company.razorpay_key_secret;
        } else {
            logger.warn(`Company ${company_id} missing Razorpay keys, falling back to global keys.`);
        }
    }

    const razorpay = new Razorpay({
        key_id:     key_id,
        key_secret: key_secret,
    });

    const options = {
        amount: Math.round(amount * 100),
        currency: "INR",
        accept_partial: false,
        description: receipt,
        notes,
    };

    // Use Payment Links API so the user can scan and pay on their phone
    const paymentLink = await razorpay.paymentLink.create(options);

    logger.info({ payment_link_id: paymentLink.id, amount }, "Razorpay Payment Link created");

    return {
        id: paymentLink.id,
        short_url: paymentLink.short_url
    };
};

// verify webhook signature given by razorpay
export const verifyWebhookSignature = (rawBody, signature, secret) => {
    const expectedSignature = crypto
        .createHmac("sha256", secret || process.env.RAZORPAY_KEY_SECRET)
        .update(rawBody)
        .digest("hex");

    return expectedSignature === signature;
};
