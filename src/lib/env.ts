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
  EMAIL_FROM: z.string().default("Maison Vierkant <noreply@maison-vierkant.in>"),
  ADMIN_NOTIFY_EMAIL: z.string().email().optional(),
  // Razorpay (server-only secrets). The public key id is also exposed below for the browser checkout.
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  // Public key id surfaced to the browser checkout (mirror of RAZORPAY_KEY_ID).
  NEXT_PUBLIC_RAZORPAY_KEY_ID: z.string().optional(),
  // Allow Cash-on-Delivery as a checkout option.
  COD_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // ---- Rate limiting (Upstash Redis, optional) ----
  // Empty string in .env means "unset" — coerce it to undefined before url-validation.
  UPSTASH_REDIS_REST_URL: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().url().optional(),
  ),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
});

export const env = schema.parse(process.env);

// Fail fast at RUNTIME in production if the auth secret was left as a dev
// placeholder — a weak/shared secret silently breaks session decoding.
// Skipped during `next build` (page-data collection), where env vars injected
// for runtime aren't necessarily present yet; the check still runs when the
// server actually boots and handles requests.
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
if (
  !isBuildPhase &&
  env.NODE_ENV === "production" &&
  (!env.NEXTAUTH_SECRET || env.NEXTAUTH_SECRET.length < 32 || env.NEXTAUTH_SECRET.includes("dev-secret"))
) {
  throw new Error(
    "NEXTAUTH_SECRET must be a strong (>=32 char) value in production. Generate one with: openssl rand -base64 32",
  );
}

/** True when a global Upstash Redis limiter is configured (else in-memory fallback). */
export const upstashReady = !!env.UPSTASH_REDIS_REST_URL && !!env.UPSTASH_REDIS_REST_TOKEN;

/** True when real Razorpay credentials are configured (gateway is live, not mock). */
export const razorpayReady =
  env.PAYMENT_PROVIDER === "razorpay" && !!env.RAZORPAY_KEY_ID && !!env.RAZORPAY_KEY_SECRET;

/**
 * True when the Razorpay WEBHOOK secret is configured. When false, webhook
 * delivery cannot be verified, so the asynchronous "paid even if the browser
 * closed" path is INACTIVE — only the synchronous /verify callback creates orders.
 * Set RAZORPAY_WEBHOOK_SECRET (Razorpay Dashboard → Settings → Webhooks) to enable it.
 */
export const razorpayWebhookReady = razorpayReady && !!env.RAZORPAY_WEBHOOK_SECRET;

/** True when Resend is configured (real email delivery, not console-log). */
export const emailReady = !!env.RESEND_API_KEY;

/** Public base URL for links in emails. */
export const appUrl =
  env.APP_URL ?? env.NEXTAUTH_URL ?? (env.NODE_ENV === "production" ? "https://www.maison-vierkant.in" : "http://localhost:3000");
