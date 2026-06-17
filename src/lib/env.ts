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
  // Public base URL of the app (used in email links). Falls back to NEXTAUTH_URL.
  APP_URL: z.string().url().optional(),
  // ---- Email (Resend) ----
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Maison Vierkant <onboarding@resend.dev>"),
  ADMIN_NOTIFY_EMAIL: z.string().email().optional(),
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

/** True when Resend is configured (real email delivery, not console-log). */
export const emailReady = !!env.RESEND_API_KEY;

/** Public base URL for links in emails. */
export const appUrl = env.APP_URL ?? env.NEXTAUTH_URL ?? "http://localhost:3000";
