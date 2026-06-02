import { Router } from "express";
import { addProduct, updateEntry, removeEntry } from "../controllers/adminCatalogController.js";
import { authMiddleware }   from "../middlewares/authMiddleware.js";
import { tenantMiddleware } from "../middlewares/tenantMiddleware.js";
import { authorizeRoles }   from "../middlewares/rbacMiddleware.js";
import { addCatalogSchema, updateCatalogSchema } from "../validators/catalogValidator.js";


const router = Router();

router.use(authMiddleware);
router.use(tenantMiddleware);

router.use(authorizeRoles("SUPER_ADMIN","ADMIN"));

router.post("/",addProduct);

router.put("/:id",updateEntry);

router.delete("/:id",removeEntry);

export default router;