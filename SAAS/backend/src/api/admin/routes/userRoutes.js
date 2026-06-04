import { Router } from "express";
import { getMe, listUsers, inviteUser, updateUserStatus } from "../controllers/userController.js";
import { authMiddleware }   from "../middlewares/authMiddleware.js";
import { tenantMiddleware } from "../middlewares/tenantMiddleware.js";
import { authorizeRoles }   from "../middlewares/rbacMiddleware.js";
import { inviteUserSchema, updateUserStatusSchema } from "../validators/userValidator.js";
import validate from "../../../utils/validate.js";

const router = Router();

// Apply auth + tenant to ALL user routes
router.use(authMiddleware);
router.use(tenantMiddleware);

// ─── Any authenticated user ───────────────────────────────────────────────────
// GET /api/admin/users/me
router.get("/me", getMe);

// ─── SUPER_ADMIN only ─────────────────────────────────────────────────────────
// GET /api/admin/users
router.get(
  "/",
  authorizeRoles("SUPER_ADMIN"),
  listUsers
);

// POST /api/admin/users/invite
router.post(
  "/invite",
  authorizeRoles("SUPER_ADMIN"),
  validate(inviteUserSchema),
  inviteUser
);

// PATCH /api/admin/users/:id/status
router.patch(
  "/:id/status",
  authorizeRoles("SUPER_ADMIN"),
  validate(updateUserStatusSchema),
  updateUserStatus
);

export default router;
