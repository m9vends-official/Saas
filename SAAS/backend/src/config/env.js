import { z } from "zod";

// Define the shape and rules of every required environment variable
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
  ML_MODEL_API_URL: z.string().url().default("http://localhost:8000"),
  ML_MODEL_TIMEOUT_MS: z.string().regex(/^\d+$/).default("5000"),
  SECURITY_MODEL_API_URL: z.string().url().default("http://localhost:8001"),
  SECURITY_MODEL_TIMEOUT_MS: z.string().regex(/^\d+$/).default("120000"),
  SECURITY_FRAME_UPLOAD_LIMIT: z.string().default("8mb"),
});

// Parse and validate — crashes immediately on startup if anything is missing/wrong
// This saves you from mysterious runtime errors hours later
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:");
  console.error(parsed.error.format());
  process.exit(1); // Hard stop — do NOT start the server with bad config
}

export const env = parsed.data;
