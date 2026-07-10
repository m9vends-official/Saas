import {Router} from "express";
import {authMiddleware} from '../middlewares/authMiddleware.js'
import {tenantMiddleware} from '../middlewares/tenantMiddleware.js'
import { paymentMethods, revenueByMachine, revenueOverTime, summary, topProducts } from "../controllers/analyticsController.js";

const router = Router();

router.use(authMiddleware)
router.use(tenantMiddleware)

// GET /api/admin/analytics/summary
router.get("/summary",summary);

// GET /api/admin/analytics/revenue-by-machine
router.get("/revenue-by-machine",revenueByMachine);

// GET /api/admin/analytics/top-products
router.get("/top-products",topProducts);

// GET /api/admin/analytics/revenue-over-time
router.get("/revenue-over-time",revenueOverTime);

// GET /api/admin/analytics/payment-methods
router.get("/payment-methods",paymentMethods);

export default router;

