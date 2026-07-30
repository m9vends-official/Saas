import { Router } from "express";

import { authMiddleware } from "../middlewares/authMiddleware.js";
import { authorizeRoles } from "../middlewares/rbacMiddleware.js";
import { tenantMiddleware } from "../middlewares/tenantMiddleware.js";
import {
  machineModelHealth,
  machineModelInfo,
  reloadMachineModel,
  resetMachineModelState,
  trainMachineModel,
} from "../controllers/machineModelController.js";

const router = Router();

router.use(authMiddleware);
router.use(tenantMiddleware);

// GET /api/admin/machine-model/health
router.get("/health", machineModelHealth);

// GET /api/admin/machine-model/info
router.get("/info", machineModelInfo);

// POST /api/admin/machine-model/train
router.post(
  "/train",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  trainMachineModel
);

// POST /api/admin/machine-model/reload
router.post(
  "/reload",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "TECHNICIAN"),
  reloadMachineModel
);

// POST /api/admin/machine-model/reset-state
router.post(
  "/reset-state",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "TECHNICIAN"),
  resetMachineModelState
);

export default router;
