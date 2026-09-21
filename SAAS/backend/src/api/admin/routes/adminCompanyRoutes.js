import { Router } from "express";
import { getMyCompany, updateMyCompany } from "../controllers/adminCompanyController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { tenantMiddleware } from "../middlewares/tenantMiddleware.js";
import { authorizeRoles } from "../middlewares/rbacMiddleware.js";

const router = Router();

router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(authorizeRoles("ADMIN", "SUPER_ADMIN")); // Only admins can manage company settings

// GET /api/admin/company
router.get("/", getMyCompany);

// PUT /api/admin/company
router.put("/", updateMyCompany);

export default router;
