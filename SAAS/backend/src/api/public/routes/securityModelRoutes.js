import express from "express";

import { analyzeSecurityFrameHandler } from "../controllers/securityModelController.js";

const router = express.Router();

const uploadFrame = express.raw({
  type: "multipart/form-data",
  limit: process.env.SECURITY_FRAME_UPLOAD_LIMIT || "8mb",
});

// POST /api/public/security-model/analyze
router.post("/analyze", uploadFrame, analyzeSecurityFrameHandler);

export default router;

