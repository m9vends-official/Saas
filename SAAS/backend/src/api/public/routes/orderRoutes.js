import { checkOrderStatus, createOrder, cancelOrderHandler, handleWebhook } from "../controllers/orderController.js";
import {Router} from 'express'

const router = Router();

// POST /api/public/order
router.post("/", createOrder);

// POST /api/public/order/:id/cancel
router.post("/:id/cancel", cancelOrderHandler);

// GET /api/public/order/:id/status
router.get("/:id/status", checkOrderStatus);

// POST /api/public/order/webhook <- Razorpay calls this
router.post("/webhook", handleWebhook);

export default router;