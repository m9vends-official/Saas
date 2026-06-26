import {Router} from 'express'
import {authMiddleware} from '../middlewares/authMiddleware.js'
import {tenantMiddleware} from '../middlewares/tenantMiddleware.js'
import { authorizeRoles }   from "../middlewares/rbacMiddleware.js";
import { confirmCash, listOrders } from '../controllers/orderController.js';

const router = Router();

router.use(authMiddleware);
router.use(tenantMiddleware);

// GET /api/admin/order?machine_id=VM-001&status=PAID&page=1
router.get("/",listOrders);

// POST /api/admin/orders/:id/confirm-cash
// Only ADMIN and SUPER_ADMIN can confirm cash — not technicians
router.post("/:id/confirm-cash",authorizeRoles("SUPER_ADMIN","ADMIN"),confirmCash);

export default router;