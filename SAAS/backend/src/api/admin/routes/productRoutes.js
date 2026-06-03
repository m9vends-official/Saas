import express from "express";
import { createProduct, listProducts, getProduct, updateProduct, deleteProduct } from "../controllers/productController.js";
import { authMiddleware }   from "../middlewares/authMiddleware.js";
import { tenantMiddleware } from "../middlewares/tenantMiddleware.js";
import { authorizeRoles }   from "../middlewares/rbacMiddleware.js";
import { createProductSchema, updateProductSchema } from "../validators/productValidator.js";
import validate from "../../../utils/validate.js";

const router = express.Router();

// ─── Apply to ALL product routes ──────────────────────────────────────────────
router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(authorizeRoles("SUPER_ADMIN", "ADMIN"));

// POST   /api/admin/products
router.post("/",    validate(createProductSchema), createProduct);

// GET    /api/admin/products
router.get("/",     listProducts);

// GET    /api/admin/products/:id
router.get("/:id",  getProduct);

// PUT    /api/admin/products/:id
router.put("/:id",  validate(updateProductSchema), updateProduct);

// DELETE /api/admin/products/:id
router.delete("/:id", deleteProduct);

export default router;
