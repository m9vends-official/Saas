import { Router } from "express";
import { authMiddleware }   from "../middlewares/authMiddleware.js";
import { authorizeRoles }   from "../middlewares/rbacMiddleware.js";
import {
  listMachines,
  getMachineDetail,
  provision,
  dispatchCommand,
  getMachineTelemetry,
} from "../controllers/machineController.js";

const router = Router();

// All machine routes require a valid JWT
router.use(authMiddleware);

// ── Machine List ──────────────────────────────────────────────────────────────
// All roles can list machines (TECHNICIAN gets filtered to assigned only — service layer)
router.get("/", listMachines);

// ── Provision a New Machine via QR scan ───────────────────────────────────────
// Only SUPER_ADMIN and ADMIN can provision new machines
router.post(
  "/provision",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  provision
);

// ── Single Machine Detail ─────────────────────────────────────────────────────
// All roles can view (TECHNICIAN access checked in service layer)
router.get("/:machine_id", getMachineDetail);

// ── Machine Telemetry (latest cached snapshot) ────────────────────────────────
router.get("/:machine_id/telemetry", getMachineTelemetry);

// ── Send Command to Machine ───────────────────────────────────────────────────
// Only SUPER_ADMIN and ADMIN can send hardware commands
router.post(
  "/:machine_id/commands",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  dispatchCommand
);

export default router;
