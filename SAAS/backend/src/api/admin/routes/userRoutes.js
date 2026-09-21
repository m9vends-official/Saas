import { Router } from "express";
import { getMe, listUsers, inviteUser, updateUserStatus, updateUser, deleteUser } from "../controllers/userController.js";
import { authMiddleware }   from "../middlewares/authMiddleware.js";
import { tenantMiddleware } from "../middlewares/tenantMiddleware.js";
import { authorizeRoles }   from "../middlewares/rbacMiddleware.js";
import { inviteUserSchema, updateUserStatusSchema } from "../validators/userValidator.js";
import validate from "../../../utils/validate.js";

const router = Router();

// Apply auth + tenant to ALL user routes
router.use(authMiddleware);
router.use(tenantMiddleware);

// â”€â”€â”€ Any authenticated user â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// GET /api/admin/users/me
router.get("/me", getMe);

// â”€â”€â”€ SUPER_ADMIN only â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// GET /api/admin/users
router.get(
  "/",
  authorizeRoles("SUPER_ADMIN"),
  listUsers
);

// POST /api/admin/users  (also accessible as /invite for backwards compat)
router.post(
  "/",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  validate(inviteUserSchema),
  inviteUser
);

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

// PUT /api/admin/users/:id
router.put(
  "/:id",
  authorizeRoles("SUPER_ADMIN"),
  updateUser
);


// DELETE /api/admin/users/:id
router.delete(
  "/:id",
  authorizeRoles("SUPER_ADMIN"),
  deleteUser
);

export default router;
