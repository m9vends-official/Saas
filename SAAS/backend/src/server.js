// Load .env FIRST — before any other import reads process.env
import dotenv from "dotenv";
dotenv.config();

import { z } from "zod";

// ─── Validate Environment Variables ──────────────────────────────────────────
// Define the shape and rules of every required environment variable.
// This runs immediately after dotenv loads, so all vars are available.
const envSchema = z.object({
  PORT:                z.string().default("5000"),
  NODE_ENV:            z.enum(["development", "production", "test"]).default("development"),
  MONGO_URI:           z.string().min(1, "MONGO_URI is required"),
  JWT_ACCESS_SECRET:   z.string().min(10, "JWT_ACCESS_SECRET must be at least 10 chars"),
  JWT_REFRESH_SECRET:  z.string().min(10, "JWT_REFRESH_SECRET must be at least 10 chars"),
  ACCESS_TOKEN_EXPIRY:  z.string().default("1d"),
  REFRESH_TOKEN_EXPIRY: z.string().default("7d"),

  // ── Phase 3 stubs (optional — will be wired in Phase 3) ─────────────────
  MQTT_BROKER_URL: z.string().default("mqtt://localhost:1883"),
  INFLUXDB_URL:    z.string().default("http://localhost:8086"),
  INFLUXDB_TOKEN:  z.string().default(""),
  INFLUXDB_ORG:    z.string().default("m9vends"),
  INFLUXDB_BUCKET: z.string().default("telemetry"),

  // ── Frontend origin for CORS ─────────────────────────────────────────────
  FRONTEND_URL: z.string().default("http://localhost:5173"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:");
  console.error(parsed.error.format());
  process.exit(1); // Hard stop — do NOT start the server with bad config
}

// ─── Application Imports ─────────────────────────────────────────────────────
// These run AFTER dotenv is loaded and env vars are validated
import http from "http";
import app from "./app.js";
import { connectDB } from "./config/db.js";
import logger from "./utils/logger.js";

const PORT = process.env.PORT || 5000;

// ─── HTTP Server ──────────────────────────────────────────────────────────────
// NOTE: Wrapped in http.createServer so Socket.io can be attached in Phase 3.
const httpServer = http.createServer(app);

// ─── Boot Sequence ────────────────────────────────────────────────────────────
async function startServer() {
  // 1. Connect to MongoDB (must succeed before anything else)
  await connectDB();

  // 2. Start listening
  httpServer.listen(PORT, () => {
    logger.info(`🚀 Server running on http://localhost:${PORT}`);
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