import express from 'express';
import device from './device/controller.device.js'
const router = express.Router()
router.use(express.json())

router.use('/device', device)

export default router