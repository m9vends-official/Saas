import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../config/error.config.js';
import { provisionDevice } from '../../services/device.services.js';
const router = express.Router()
router.use(express.json())

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { serialNumber, userID } = req.body as { serialNumber: string, userID: string }
        if (!serialNumber || !userID) {
            throw new AppError("Bad Request", 400)
        }
        const vid = await provisionDevice(serialNumber, userID)
        res.status(200).json({
            vid,
            message: "Provisioning Successful"
        })
    } catch (error) {
        next(error)
    }
})

export default router