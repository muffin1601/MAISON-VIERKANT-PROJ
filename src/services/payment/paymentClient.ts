"use client";

import type { RazorpaySuccess } from "@/hooks/useRazorpay";

/**
 * Browser-side wrappers around the checkout + payment APIs. Thin, typed, and
 * centralised so the UI never hand-rolls fetch calls. All money is decided by the
 * server — the client only passes a cart, a session token, or a gateway payload.
 */

export interface CheckoutItem {
  code: string;
  variantCode: string;
  finish: string;
  qty: number;
}
export interface CheckoutCustomer {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  gst?: string;
  addr1?: string;
  addr2?: string;
  city?: string;
  state?: string;
  pin?: string;
  notes?: string;
}

export interface CheckoutSessionData {
  token: string;
  orderNumber: string;
  subtotalInr: number;
  gstInr: number;
  shippingInr: number;
  discountInr: number;
  totalInr: number;
  advanceInr: number;
  itemCount: number;
}

export interface CreatedOrder {
  keyId: string;
  gatewayOrderId: string;
  amount: number; // paise
  amountInr: number;
  currency: string;
  sessionToken: string;
  orderNumber: string;
  customer: { name: string; email: string; contact: string };
}

export interface VerifiedPayment {
  status: string;
  orderNumber: string;
  paymentId: string;
  amountPaid: number;
  alreadyExisted: boolean;
}

export interface PlacedBankOrder {
  orderId: string;
  orderNumber: string;
  totalInr: number;
  advanceInr: number;
}

class PaymentError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new PaymentError(json?.error?.message || "Something went wrong.", json?.error?.code);
  }
  return json.data as T;
}

/** Create a draft checkout session (server computes & returns the totals). */
export function createCheckoutSession(
  customer: CheckoutCustomer,
  items: CheckoutItem[],
): Promise<CheckoutSessionData> {
  return postJson<CheckoutSessionData>("/api/checkout/session", { customer, items });
}

/** Create (or reuse) the Razorpay order for a session's advance. */
export function createPaymentOrder(sessionToken: string): Promise<CreatedOrder> {
  return postJson<CreatedOrder>("/api/payments/create-order", { sessionToken });
}

/** Verify the Razorpay payload server-side; resolves once the real order is created. */
export function verifyPayment(sessionToken: string, success: RazorpaySuccess): Promise<VerifiedPayment> {
  return postJson<VerifiedPayment>("/api/payments/verify", { sessionToken, ...success });
}

/** Place a bank-transfer order from a session (creates a PENDING_PAYMENT order). */
export function placeBankOrder(sessionToken: string): Promise<PlacedBankOrder> {
  return postJson<PlacedBankOrder>("/api/checkout/place-order", { sessionToken });
}

export { PaymentError };
