import crypto from "node:crypto";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

/**
 * Verifies the Razorpay signature checks against signatures produced exactly the
 * way Razorpay produces them, so a real gateway response will validate and a
 * tampered one will not. Env is stubbed before importing so the module reads
 * the test secret.
 */
const KEY_SECRET = "test_secret_key_123";
const WEBHOOK_SECRET = "test_webhook_secret_456";

let verifyPaymentSignature: typeof import("@/services/payments/razorpay").verifyPaymentSignature;
let verifyWebhookSignature: typeof import("@/services/payments/razorpay").verifyWebhookSignature;

beforeAll(async () => {
  vi.stubEnv("PAYMENT_PROVIDER", "razorpay");
  vi.stubEnv("RAZORPAY_KEY_ID", "rzp_test_abc");
  vi.stubEnv("RAZORPAY_KEY_SECRET", KEY_SECRET);
  vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", WEBHOOK_SECRET);
  vi.stubEnv("DATABASE_URL", "postgresql://u:p@localhost:5432/db");
  const mod = await import("@/services/payments/razorpay");
  verifyPaymentSignature = mod.verifyPaymentSignature;
  verifyWebhookSignature = mod.verifyWebhookSignature;
});

afterAll(() => vi.unstubAllEnvs());

const sign = (data: string, secret: string) =>
  crypto.createHmac("sha256", secret).update(data).digest("hex");

describe("verifyPaymentSignature", () => {
  it("accepts a correctly signed payment", () => {
    const gatewayOrderId = "order_ABC123";
    const gatewayPaymentId = "pay_XYZ789";
    const signature = sign(`${gatewayOrderId}|${gatewayPaymentId}`, KEY_SECRET);
    expect(verifyPaymentSignature({ gatewayOrderId, gatewayPaymentId, signature })).toBe(true);
  });

  it("rejects a tampered amount/payment id", () => {
    const signature = sign(`order_ABC123|pay_XYZ789`, KEY_SECRET);
    expect(
      verifyPaymentSignature({
        gatewayOrderId: "order_ABC123",
        gatewayPaymentId: "pay_TAMPERED",
        signature,
      }),
    ).toBe(false);
  });

  it("rejects a signature made with the wrong secret", () => {
    const signature = sign(`order_ABC123|pay_XYZ789`, "wrong_secret");
    expect(
      verifyPaymentSignature({
        gatewayOrderId: "order_ABC123",
        gatewayPaymentId: "pay_XYZ789",
        signature,
      }),
    ).toBe(false);
  });
});

describe("verifyWebhookSignature", () => {
  it("accepts a correctly signed webhook body", () => {
    const body = JSON.stringify({ event: "payment.captured" });
    expect(verifyWebhookSignature(body, sign(body, WEBHOOK_SECRET))).toBe(true);
  });

  it("rejects a missing or wrong signature", () => {
    const body = JSON.stringify({ event: "payment.captured" });
    expect(verifyWebhookSignature(body, null)).toBe(false);
    expect(verifyWebhookSignature(body, sign(body, "nope"))).toBe(false);
  });
});
