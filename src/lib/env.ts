import { z } from "zod";

/**
 * Centralized, validated environment access. Fails fast at boot if required
 * server vars are missing. Import `env` instead of reading process.env directly.
 */
const schema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().min(1).optional(),
  NEXTAUTH_URL: z.string().url().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  PAYMENT_PROVIDER: z.enum(["mock", "razorpay"]).default("mock"),
  OTP_PROVIDER: z.enum(["mock", "msg91", "twilio"]).default("mock"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export const env = schema.parse(process.env);
