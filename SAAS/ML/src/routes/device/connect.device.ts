import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../config/error.config.js';
import { generateMqttCredentials } from '../../services/device.services.js';

export const connectDevice = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params as { id: string }
        if (!id) {
            throw new AppError("Bad Request", 400)
        }
        const mqttCredentials = await generateMqttCredentials(id)
        res.status(200).json({
            message: 'Successfully generated mqtt credentials',
            mqttCredentials
        })
    } catch (error) {
        next(error)
    }
}