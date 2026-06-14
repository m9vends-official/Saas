import { Router } from "express";
import {
  getHistory,
  getStatus,
  getAnalytics,
  getSalesSummary,
} from "../controllers/telemetryController.js";
import { authMiddleware }  from "../middlewares/authMiddleware.js";
import { tenantMiddleware } from "../middlewares/tenantMiddleware.js";
import { authorizeRoles }  from "../middlewares/rbacMiddleware.js";

const router = Router();

// All telemetry routes: JWT → company scope → role check
router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(authorizeRoles("ADMIN", "TECHNICIAN"));

// ── MongoDB-backed endpoints ──────────────────────────────────────────────────

// GET /api/admin/telemetry/:device_id/history?limit=100&type=STATUS
router.get("/:device_id/history", getHistory);

// GET /api/admin/telemetry/:device_id/status
router.get("/:device_id/status", getStatus);

// ── InfluxDB-backed endpoints (analytics) ────────────────────────────────────

// GET /api/admin/telemetry/:device_id/analytics?range=24h&metric=temperature
router.get("/:device_id/analytics", getAnalytics);

// GET /api/admin/telemetry/:device_id/sales-summary?range=7d
router.get("/:device_id/sales-summary", getSalesSummary);

export default router;
