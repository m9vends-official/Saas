import express from "express";
import { register, login, refresh, logout } from "../controllers/authController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { validateRegister, validateLogin } from "../validators/authValidator.js";
import rateLimit from "express-rate-limit";

// ─── Rate Limiter ─────────────────────────────────────────────────────────────
// Applies ONLY to auth routes — prevents brute-force login attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                   // max 10 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many attempts. Please try again after 15 minutes.",
  },
});

const router = express.Router();

// POST /api/admin/auth/register
router.post("/register", authLimiter, validateRegister, register);

// POST /api/admin/auth/login
router.post("/login", authLimiter, validateLogin, login);

// POST /api/admin/auth/refresh
router.post("/refresh", refresh);

// POST /api/admin/auth/logout  (protected — valid access token required)
router.post("/logout", authMiddleware, logout);

export default router;