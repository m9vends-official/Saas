// Load .env FIRST — before any other import reads process.env
import dotenv from "dotenv";
dotenv.config();

import { z } from "zod";

// ─── Validate Environment Variables ──────────────────────────────────────────
const envSchema = z.object({
  PORT:                z.string().default("5000"),
  NODE_ENV:            z.enum(["development", "production", "test"]).default("development"),
  MONGO_URI:           z.string().min(1, "MONGO_URI is required"),
  JWT_ACCESS_SECRET:   z.string().min(10, "JWT_ACCESS_SECRET must be at least 10 chars"),
  JWT_REFRESH_SECRET:  z.string().min(10, "JWT_REFRESH_SECRET must be at least 10 chars"),
  ACCESS_TOKEN_EXPIRY:  z.string().default("1d"),
  REFRESH_TOKEN_EXPIRY: z.string().default("7d"),
  FRONTEND_URL: z.string().default("http://localhost:5173"),
  KIOSK_URL:    z.string().default("http://localhost:5174"),
  RAZORPAY_KEY_ID:     z.string().default(""),
  RAZORPAY_KEY_SECRET: z.string().default(""),

  // ── MQTT / IoT ─────────────────────────────────────────────────────────────
  MQTT_BROKER_HOST:     z.string().default(""),
  MQTT_BROKER_TCP_PORT: z.string().default("1883"),
  MQTT_ADMIN_USERNAME:  z.string().default(""),
  MQTT_ADMIN_PASSWORD:  z.string().default(""),
  IOT_API_BASE_URL:     z.string().default(""),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:");
  console.error(parsed.error.format());
  process.exit(1);
}

// ─── Application Imports ──────────────────────────────────────────────────────
import http            from "http";
import { Server }      from "socket.io";
import jwt             from "jsonwebtoken";
import app             from "./app.js";
import { connectDB }   from "./config/db.js";
import { setIo }       from "./services/socketService.js";
import logger          from "./utils/logger.js";
import { initMqttService } from "./services/mqttService.js";

const PORT = process.env.PORT || 5000;

const httpServer = http.createServer(app);

// ─── Socket.IO Setup ─────────────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:3000",  // Next.js admin panel dev server
      process.env.FRONTEND_URL, // Production URL from .env (Admin Panel)
      process.env.KIOSK_URL,    // Production URL for User Kiosk
    ].filter(Boolean),
    credentials: true,
  },
});

// ── Socket.IO Authentication Middleware ────────────────────────────────────
// Every socket connection must present a valid JWT access token.
// On success, socket.data.user is populated (user_id, company_id, role).
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("Authentication token missing"));
    }

    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    socket.data.user = {
      user_id:    decoded.user_id,
      company_id: decoded.company_id,
      role:       decoded.role,
    };

    next();
  } catch (err) {
    logger.warn("[Socket.IO] Auth failed:", err.message);
    next(new Error("Invalid or expired token"));
  }
});

// ── Socket.IO Connection Handler ───────────────────────────────────────────
io.on("connection", (socket) => {
  const { user_id, company_id, role } = socket.data.user;

  // Join the company room — all events for this company broadcast here.
  // This ensures Company A never sees Company B's telemetry or alerts.
  socket.join(company_id);

  logger.info(`[Socket.IO] Connected: user=${user_id} role=${role} company=${company_id}`);

  socket.on("disconnect", (reason) => {
    logger.info(`[Socket.IO] Disconnected: user=${user_id} reason=${reason}`);
  });
});

// Attach io to app so controllers can emit events (e.g., cash order confirmed)
app.set("io", io);
setIo(io);

// ─── Server Startup ───────────────────────────────────────────────────────────
async function startServer() {
  // 1. Connect to MongoDB
  await connectDB();

  // 2. Initialize MQTT service (bridges IoT broker → Socket.IO rooms)
  if (process.env.MQTT_BROKER_HOST && process.env.MQTT_ADMIN_USERNAME) {
    initMqttService(io);
    logger.info("[MQTT] Service started");
  } else {
    logger.warn("[MQTT] Skipping MQTT — MQTT_BROKER_HOST or MQTT_ADMIN_USERNAME not set in .env");
  }

  // 3. Start HTTP + Socket.IO server
  httpServer.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`);
    logger.info(`Health check → http://localhost:${PORT}/health`);
    logger.info(`Environment → ${process.env.NODE_ENV}`);
  });
}

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
function shutdown(signal) {
  logger.info(`${signal} received — shutting down gracefully`);
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

startServer();
// Trigger nodemon restart

// Trigger nodemon restart 2
