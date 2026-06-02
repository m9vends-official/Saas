import { authMiddleware } from "../middlewares/authMiddleware";
import express from express;
import { tenantMiddleware } from "../middlewares/tenantMiddleware";
import { authorizeRoles } from "../middlewares/rbacMiddleware";
import { createDevice, getDevice, listDevices, updateDevice } from "../controllers/deviceController";

const router = express.Router();

router.use(authMiddleware);
router.use(tenantMiddleware);

router.use(authorizeRoles("SUPER_ADMIN","ADMIN"));

router.post('/',createDevice);
router.get('/',listDevices);
router.get('/:id',getDevice);
router.put('/:id',updateDevice);

export default router;