import { Router } from "express";
import { addProduct, updateEntry, removeEntry } from "../controllers/adminCatalogController.js";
import { authMiddleware }   from "../middlewares/authMiddleware.js";
import { tenantMiddleware } from "../middlewares/tenantMiddleware.js";
import { authorizeRoles }   from "../middlewares/rbacMiddleware.js";
import { addCatalogSchema, updateCatalogSchema } from "../validators/catalogValidator.js";
import validate from "../../../utils/validate.js";

const router = Router();

// ─── Apply to ALL catalog admin routes ───────────────────────────────────────
router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(authorizeRoles("SUPER_ADMIN", "ADMIN"));

// POST /api/admin/catalog
router.post("/", validate(addCatalogSchema), addProduct);

// PUT /api/admin/catalog/:id
router.put("/:id", validate(updateCatalogSchema), updateEntry);

// DELETE /api/admin/catalog/:id
router.delete("/:id", removeEntry);

// GET /api/admin/catalog?machine_id=VM-BPL-001
router.get("/", listCatalogEntries);

export default router;