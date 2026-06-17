import pino from "pino";

/**
 * Shared server-side structured logger. Pretty in dev, JSON in production.
 * Import this instead of using console.* in server code.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug"),
});
