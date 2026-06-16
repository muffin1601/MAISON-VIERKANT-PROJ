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
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default("mvi-media"),
  PAYMENT_PROVIDER: z.enum(["mock", "razorpay"]).default("mock"),
  OTP_PROVIDER: z.enum(["mock", "msg91", "twilio"]).default("mock"),
  // Razorpay (server-only secrets). The public key id is also exposed below for the browser checkout.
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  // Allow Cash-on-Delivery as a checkout option.
  COD_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export const env = schema.parse(process.env);

/** True when real Razorpay credentials are configured (gateway is live, not mock). */
export const razorpayReady =
  env.PAYMENT_PROVIDER === "razorpay" && !!env.RAZORPAY_KEY_ID && !!env.RAZORPAY_KEY_SECRET;
