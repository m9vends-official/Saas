import pino from "pino";

const logger = pino({

  level: process.env.NODE_ENV === "production" ? "warn" : "debug",

  transport:
    process.env.NODE_ENV !== "production"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,        // Colored output in terminal
            translateTime: "SYS:HH:MM:ss", // Human-readable timestamps
            ignore: "pid,hostname",         // Keep logs clean
          },
        }
      : undefined, // In production, use raw JSON (no pino-pretty overhead)
});

export default logger;

/*
  HOW TO USE THIS LOGGER:
  ========================

  import logger from "../utils/logger.js";

  INFO  — Something good happened
  logger.info("Server started on port 5000");
  logger.info({ user_id: "abc" }, "User registered");

  WARN  — Something suspicious
  logger.warn({ email }, "Failed login attempt");

  ERROR — Something broke
  logger.error({ err: error }, "Unhandled error in controller");

  DEBUG — Dev-only details (won't show in production)
  logger.debug({ body: req.body }, "Incoming request body");
*/
