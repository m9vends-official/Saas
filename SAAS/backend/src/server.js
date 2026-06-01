// Load .env FIRST — before any other import reads process.env
import dotenv from "dotenv";
dotenv.config();

import { z } from "zod";

// ─── Validate Environment Variables ──────────────────────────────────────────
// Define the shape and rules of every required environment variable.
// This runs immediately after dotenv loads, so all vars are available.
const envSchema = z.object({
  PORT: z.string().default("5000"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  MONGO_URI: z.string().min(1, "MONGO_URI is required"),
  JWT_ACCESS_SECRET: z
    .string()
    .min(10, "JWT_ACCESS_SECRET must be at least 10 chars"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(10, "JWT_REFRESH_SECRET must be at least 10 chars"),
  ACCESS_TOKEN_EXPIRY: z.string().default("1d"),
  REFRESH_TOKEN_EXPIRY: z.string().default("7d"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:");
  console.error(parsed.error.format());
  process.exit(1); // Hard stop — do NOT start the server with bad config
}

// ─── Application Imports ─────────────────────────────────────────────────────
// These run AFTER dotenv is loaded and env vars are validated
import app from "./app.js";
import { connectDB } from "./config/db.js";
import logger from "./utils/logger.js";

const PORT = process.env.PORT || 5000;

// Connect to MongoDB first, then start listening
connectDB();

app.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`);
  logger.info(`Health check → http://localhost:${PORT}/health`);
  logger.info(`Environment → ${process.env.NODE_ENV}`);
});