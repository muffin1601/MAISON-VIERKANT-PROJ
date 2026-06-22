import "server-only";
import crypto from "node:crypto";
import Razorpay from "razorpay";
import { env, razorpayReady } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Server-side Razorpay gateway adapter. The ONLY place the secret key and the
 * Razorpay SDK are touched. All amounts crossing this boundary are in the
 * smallest currency unit (paise) as Razorpay requires.
 *
 * Hardening:
 *  - Never instantiated unless real credentials are present (`razorpayReady`).
 *  - Signature/webhook verification use timing-safe comparisons.
 *  - No secret is ever logged or returned to a caller.
 */

let client: Razorpay | null = null;

/** Lazily build (and memoise) the SDK client. Throws if credentials are absent. */
function getClient(): Razorpay {
  if (!razorpayReady || !env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new Error("RAZORPAY_NOT_CONFIGURED");
  }
  if (!client) {
    client = new Razorpay({
      key_id: env.RAZORPAY_KEY_ID,
      key_secret: env.RAZORPAY_KEY_SECRET,
    });
  }
  return client;
}

/** True when the gateway can be used (mirror of env.razorpayReady, re-exported for callers). */
export function isRazorpayConfigured(): boolean {
  return razorpayReady;
}

export interface CreatedRazorpayOrder {
  id: string; // order_xxx
  amount: number; // paise
  currency: string;
  receipt: string;
}

/**
 * Create a Razorpay order for the given amount (in WHOLE rupees — converted to
 * paise here). `notes` are echoed back on webhooks for cross-checking.
 */
export async function createRazorpayOrder(params: {
  amountInr: number;
  receipt: string;
  notes?: Record<string, string>;
  currency?: string;
}): Promise<CreatedRazorpayOrder> {
  const currency = params.currency ?? "INR";
  const amountPaise = Math.round(params.amountInr * 100);
  if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
    throw new Error("INVALID_AMOUNT");
  }
  const order = await getClient().orders.create({
    amount: amountPaise,
    currency,
    receipt: params.receipt,
    notes: params.notes,
    payment_capture: true, // auto-capture on success
  });
  return {
    id: order.id,
    amount: Number(order.amount),
    currency: order.currency,
    receipt: String(order.receipt ?? params.receipt),
  };
}

/**
 * Verify the checkout success signature returned to the browser:
 *   HMAC_SHA256(razorpay_order_id + "|" + razorpay_payment_id, KEY_SECRET).
 * Timing-safe. Returns false (never throws) on any mismatch / missing secret.
 */
export function verifyPaymentSignature(params: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  signature: string;
}): boolean {
  const secret = env.RAZORPAY_KEY_SECRET;
  if (!secret || !params.razorpayOrderId || !params.razorpayPaymentId || !params.signature) {
    return false;
  }
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${params.razorpayOrderId}|${params.razorpayPaymentId}`)
    .digest("hex");
  return timingSafeEqualHex(expected, params.signature);
}

/**
 * Verify a webhook payload against the `X-Razorpay-Signature` header using the
 * dedicated webhook secret. Pass the RAW request body (string) — re-serialising
 * parsed JSON will break the HMAC.
 */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature || !rawBody) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return timingSafeEqualHex(expected, signature);
}

export interface RefundResult {
  id: string; // rfnd_xxx
  amountInr: number; // refunded amount in rupees
  status: string; // pending | processed | failed
}

/** Issue a refund (full or partial) against a captured payment. */
export async function createRefund(params: {
  razorpayPaymentId: string;
  amountInr?: number; // omit for a full refund
  notes?: Record<string, string>;
}): Promise<RefundResult> {
  const payload: { amount?: number; notes?: Record<string, string>; speed?: "normal" } = {
    speed: "normal",
    notes: params.notes,
  };
  if (typeof params.amountInr === "number") {
    payload.amount = Math.round(params.amountInr * 100);
  }
  const refund = await getClient().payments.refund(params.razorpayPaymentId, payload);
  return {
    id: refund.id,
    amountInr: Number(refund.amount ?? 0) / 100,
    status: String(refund.status ?? "pending"),
  };
}

/** Build a stable, human-readable receipt id for an order (<= 40 chars per Razorpay). */
export function buildReceipt(orderNumber: string): string {
  return `rcpt_${orderNumber}`.slice(0, 40);
}

/** Constant-time hex string comparison (guards signature checks against timing attacks). */
function timingSafeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch (err) {
    logger.warn({ err }, "razorpay signature comparison failed to decode");
    return false;
  }
}
