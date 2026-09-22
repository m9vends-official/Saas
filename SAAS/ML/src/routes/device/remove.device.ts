import type { NextFunction, Request, Response } from 'express';
import { removeDevice } from '../../services/device.services.js';
import { AppError } from '../../config/error.config.js';

export const removeDeviceHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params as { id: string }
        const { command } = req.query as { command?: "remove" }
        if (!id) {
            throw new AppError("Bad Request", 400)
        }
        const message = await removeDevice(id, command)
        res.status(200).json({
            message
        })
    } catch (error) {
        next(error)
    }
}