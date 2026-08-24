import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { tenantMiddleware } from "../middlewares/tenantMiddleware.js";
import {
  paymentMethods, revenueByMachine, revenueOverTime, summary,
  topProducts, revenueByCompany,
} from "../controllers/analyticsController.js";

const router = Router();

router.use(authMiddleware);
router.use(tenantMiddleware);

router.get("/summary",              summary);
router.get("/revenue-by-machine",   revenueByMachine);
router.get("/top-products",         topProducts);
router.get("/revenue-over-time",    revenueOverTime);
router.get("/payment-methods",      paymentMethods);
router.get("/revenue-by-company",   revenueByCompany);  // SUPER_ADMIN only

export default router;
