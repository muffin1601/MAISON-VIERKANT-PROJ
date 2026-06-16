import crypto from "node:crypto";
import { env } from "@/lib/env";

/**
 * Razorpay gateway — implemented against the Razorpay REST API with Node's
 * crypto for signature verification (the officially documented method). No SDK
 * dependency, fully server-side. Everything reads from validated env, so the
 * gateway goes live the instant real keys are configured.
 *
 * Razorpay works in the smallest currency unit: INR amounts are paise (× 100).
 */

const API_BASE = "https://api.razorpay.com/v1";

function authHeader(): string {
  const id = env.RAZORPAY_KEY_ID ?? "";
  const secret = env.RAZORPAY_KEY_SECRET ?? "";
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

export interface RazorpayOrder {
  id: string;
  amount: number; // paise
  currency: string;
  status: string;
}

/** Create a Razorpay order. `amountInr` is rupees; converted to paise here. */
export async function createRazorpayOrder(params: {
  amountInr: number;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrder> {
  const res = await fetch(`${API_BASE}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader() },
    body: JSON.stringify({
      amount: Math.round(params.amountInr * 100),
      currency: "INR",
      receipt: params.receipt,
      notes: params.notes ?? {},
      payment_capture: 1, // auto-capture on successful authorization
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Razorpay order creation failed (${res.status}): ${detail}`);
  }
  return (await res.json()) as RazorpayOrder;
}

/**
 * Verify the checkout handler signature: HMAC_SHA256(order_id|payment_id, secret).
 * Constant-time comparison to avoid timing attacks.
 */
export function verifyPaymentSignature(params: {
  gatewayOrderId: string;
  gatewayPaymentId: string;
  signature: string;
}): boolean {
  const secret = env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${params.gatewayOrderId}|${params.gatewayPaymentId}`)
    .digest("hex");
  return safeEqual(expected, params.signature);
}

/** Verify a Razorpay webhook payload: HMAC_SHA256(rawBody, webhookSecret). */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqual(expected, signature);
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}
