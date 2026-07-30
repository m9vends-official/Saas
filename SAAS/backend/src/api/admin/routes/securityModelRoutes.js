import { Router } from "express";

import { authMiddleware } from "../middlewares/authMiddleware.js";
import { tenantMiddleware } from "../middlewares/tenantMiddleware.js";
import {
  latestSecurityAnalysis,
  securityModelHealth,
} from "../controllers/securityModelController.js";

const router = Router();

router.use(authMiddleware);
router.use(tenantMiddleware);

// GET /api/admin/security-model/health
router.get("/health", securityModelHealth);

// GET /api/admin/security-model/latest
router.get("/latest", latestSecurityAnalysis);

export default router;

