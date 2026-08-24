import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { tenantMiddleware } from "../middlewares/tenantMiddleware.js";
import { listCompanies, createCompany, updateCompany } from "../controllers/companyController.js";

const router = Router();

router.use(authMiddleware);
router.use(tenantMiddleware);

router.get("/",       listCompanies);   // GET  /api/admin/companies
router.post("/",      createCompany);   // POST /api/admin/companies
router.patch("/:id",  updateCompany);   // PATCH /api/admin/companies/:id

export default router;
