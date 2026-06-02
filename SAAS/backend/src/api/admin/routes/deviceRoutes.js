import { authMiddleware } from "../middlewares/authMiddleware.js";
import express from "express";
import { tenantMiddleware } from "../middlewares/tenantMiddleware.js";
import { authorizeRoles } from "../middlewares/rbacMiddleware.js";
import { createDevice, getDevice, listDevices, updateDevice } from "../controllers/deviceController.js";

const router = express.Router();

router.use(authMiddleware);
router.use(tenantMiddleware);

router.use(authorizeRoles("SUPER_ADMIN","ADMIN"));

router.post('/',createDevice);
router.get('/',listDevices);
router.get('/:id',getDevice);
router.put('/:id',updateDevice);

export default router;