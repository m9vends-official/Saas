import fs from 'fs';
import 'dotenv/config'
import type { Request, Response, NextFunction } from 'express';

export const captureService = async (req: Request, res: Response, next: NextFunction) => {
    try {
        let html = fs.readFileSync("./public/capture.html", "utf8");

        html = html.replace(
            "{{IMAGE_ML_API_URL}}",
            (process.env.IMAGE_ML_API_URL as string) || "/capture"
        );

        res.send(html);
    } catch (error) {
        next(error)
    }
}

export const handleImageCapture = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const deviceID = (req.query.deviceID || req.query.device || "unknown-device") as string;
        const contentType = req.headers['content-type'] || "";

        if (!contentType.includes("image/jpeg")) {
            res.status(415).json({
                success: false,
                error: "Unsupported Media Type. Expected Content-Type: image/jpeg"
            });
            return;
        }

        const imageBuffer = req.body as Buffer;

        if (!imageBuffer || !Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
            res.status(400).json({
                success: false,
                error: "Empty image body"
            });
            return;
        }

        const MAX_SIZE = 10 * 1024 * 1024; // 10MB
        if (imageBuffer.length > MAX_SIZE) {
            res.status(413).json({
                success: false,
                error: "Image payload exceeds maximum limit of 10MB"
            });
            return;
        }

        // Validate JPEG magic bytes: 0xFF 0xD8 0xFF
        if (imageBuffer.length < 3 || imageBuffer[0] !== 0xff || imageBuffer[1] !== 0xd8 || imageBuffer[2] !== 0xff) {
            res.status(400).json({
                success: false,
                error: "Invalid JPEG image binary data"
            });
            return;
        }

        let threatData: any = null;
        const threatApiUrl = process.env.SECURITY_MODEL_API_URL || process.env.IMAGE_ML_API_URL;

        if (threatApiUrl) {
            try {
                const targetUrl = threatApiUrl.endsWith('/capture')
                    ? `${threatApiUrl}?deviceID=${encodeURIComponent(deviceID)}`
                    : `${threatApiUrl.replace(/\/$/, '')}/capture?deviceID=${encodeURIComponent(deviceID)}`;

                const response = await fetch(targetUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'image/jpeg'
                    },
                    body: imageBuffer
                });

                if (response.ok) {
                    const jsonRes = await response.json() as any;
                    threatData = jsonRes?.data || jsonRes;
                } else {
                    console.warn(`[Threat Detection] API returned HTTP ${response.status}`);
                }
            } catch (err: any) {
                console.error(`[Threat Detection Connection Error]: ${err?.message || err}`);
            }
        }

        res.status(200).json({
            success: true,
            deviceID,
            imageSize: imageBuffer.length,
            ...(threatData ? { threat: threatData } : {})
        });
    } catch (error) {
        next(error);
    }
};