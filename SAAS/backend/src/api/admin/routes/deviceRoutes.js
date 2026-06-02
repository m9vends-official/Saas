import express from "express";
import { createDevice, getDevice, listDevices, updateDevice } from "../controllers/deviceController.js";
import { authMiddleware }   from "../middlewares/authMiddleware.js";
import { tenantMiddleware } from "../middlewares/tenantMiddleware.js";
import { authorizeRoles }   from "../middlewares/rbacMiddleware.js";
import { createDeviceSchema, updateDeviceSchema } from "../validators/deviceValidator.js";
import validate from "../../../utils/validate.js";

const router = express.Router();

// ─── Apply to ALL device routes ───────────────────────────────────────────────
router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(authorizeRoles("SUPER_ADMIN", "ADMIN"));

// POST /api/admin/devices
router.post("/", validate(createDeviceSchema), createDevice);

// GET /api/admin/devices
router.get("/", listDevices);

// GET /api/admin/devices/:id
router.get("/:id", getDevice);

// PUT /api/admin/devices/:id
router.put("/:id", validate(updateDeviceSchema), updateDevice);

export default router;