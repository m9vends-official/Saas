import { checkOrderStatus, createOrder, handleWebhook } from "../controllers/orderController.js"; // FIX: added .js extension
import {Router} from 'express'

const router = Router();

// POST /api/public/order
router.post("/", createOrder);

// GET /api/public/order/:id/status
router.get("/:id/status",checkOrderStatus);

// POST /api/public/payment/webhook <- Razorpay calls this
router.post("/webhook",handleWebhook);

export default router;