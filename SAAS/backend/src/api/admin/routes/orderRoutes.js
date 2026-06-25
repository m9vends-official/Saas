import {Router} from 'express'
import {authMiddleware} from '../middlewares/authMiddleware.js'
import {tenantMiddleware} from '../middlewares/tenantMiddleware.js'
import { listOrders } from '../controllers/orderController.js';

const router = Router();

router.use(authMiddleware);
router.use(tenantMiddleware);

// GET /api/admin/order?machine_id=VM-001&status=PAID&page=1
router.get("/",listOrders);

export default router;