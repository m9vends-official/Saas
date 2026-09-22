import type { NextFunction, Request, Response } from 'express';
import type { device } from '../../types/device.type.js';
import { AppError } from '../../config/error.config.js';
import { getDevice, getDevices } from '../../services/device.services.js';

export const getDeviceHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { type, id } = req.params as { type: "device" | "user", id: string }
        let device: device | device[]
        let message: string
        if (!id || !type) {
            throw new AppError("Missing or Invalid ID", 400)
        }
        if (type === "device") {
            device = await getDevice(id)
            message = "device fetched successfully"
        } else {
            device = await getDevices(id)
            message = "devices fetched successfully"
        }
        res.status(200).json({
            device,
            message
        })
    } catch (error) {
        next(error)
    }
}