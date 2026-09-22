import type { Request, Response } from "express";

import { mqttClient } from "../../config/mqttBroker.config.js";
import mongoose from "mongoose";

export const commandDeviceHandler = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { message } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            // throw new AppError("Invalid Device ID", 400); // Wait, this API uses AppError or something else?
            res.status(400).json({ message: "Invalid Device ID" });
            return;
        }

        if (!message) {
            res.status(400).json({ message: "Message payload is required" });
            return;
        }

        // Publish to device/<id>/command
        const topic = `device/${id}/command`;
        const payload = typeof message === 'string' ? message : JSON.stringify(message);

        mqttClient.publish(topic, payload, { qos: 1 }, (err) => {
            if (err) {
                console.error(`[MQTT] Failed to publish command to ${topic}`, err);
                res.status(500).json({ message: "Failed to publish command" });
                return;
            }
        });

        console.log(`[Command] Dispatched command to ${topic}:`, payload);
        res.status(200).json({
            success: true,
            message: "Command dispatched successfully"
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export default commandDeviceHandler;
