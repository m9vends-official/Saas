import express from "express";
import { getMe } from "../controllers/userController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { tenantMiddleware } from "../middlewares/tenantMiddleware.js";

const router = express.Router();

// GET /api/admin/users/me
// Protected: valid JWT required → authMiddleware → tenantMiddleware → getMe
router.get("/me", authMiddleware, tenantMiddleware, getMe);

export default router;
