/**
 * Single source of truth for payment-layer enums shared by the Razorpay flow and
 * the offline bank-transfer flow. No magic strings — import these constants.
 *
 * Two distinct concepts:
 *  1. PaymentStatus   — lifecycle of a single `Payment` row (the gateway transaction).
 *  2. OrderStatus map — how a payment event moves the parent Order's lifecycle
 *     (which lives in `orderStatus.ts`). Razorpay capture reuses the existing
 *     PAYMENT_VERIFIED state so production/admin flows stay identical across both
 *     payment channels — there is ONE authoritative "paid" order state.
 */

/** Gateway transaction lifecycle (Payment.status). */
export const PaymentStatus = {
  PENDING: "PENDING", // order created at gateway, awaiting customer action
  PROCESSING: "PROCESSING", // checkout opened / authorization in flight
  CAPTURED: "CAPTURED", // money captured — success
  FAILED: "FAILED", // gateway reported failure
  REFUNDED: "REFUNDED", // fully or partially refunded
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

/** Payment provider (Payment.provider). */
export const PaymentProvider = {
  RAZORPAY: "RAZORPAY",
  BANK_TRANSFER: "BANK_TRANSFER",
  COD: "COD",
  MOCK: "MOCK",
} as const;
export type PaymentProvider = (typeof PaymentProvider)[keyof typeof PaymentProvider];

/** Customer-facing payment method chosen at checkout. */
export const PaymentMethod = {
  RAZORPAY: "RAZORPAY",
  BANK_TRANSFER: "BANK_TRANSFER",
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

/** Lifecycle of an ephemeral CheckoutSession (draft → real Order). */
export const CheckoutSessionStatus = {
  DRAFT: "DRAFT", // created, awaiting method + payment
  PAYMENT_PROCESSING: "PAYMENT_PROCESSING", // Razorpay order opened against it
  COMPLETED: "COMPLETED", // real Order created from it
  FAILED: "FAILED", // payment failed/cancelled — retryable
  EXPIRED: "EXPIRED", // older than 24h, never paid
} as const;
export type CheckoutSessionStatus =
  (typeof CheckoutSessionStatus)[keyof typeof CheckoutSessionStatus];

/** Payment slice (Payment.type). 50% advance is the default business model. */
export const PaymentType = {
  ADVANCE: "ADVANCE",
  BALANCE: "BALANCE",
  FULL: "FULL",
} as const;
export type PaymentType = (typeof PaymentType)[keyof typeof PaymentType];

/** Razorpay webhook events we handle. */
export const RazorpayEvent = {
  PAYMENT_CAPTURED: "payment.captured",
  PAYMENT_FAILED: "payment.failed",
  REFUND_CREATED: "refund.created",
} as const;
export type RazorpayEvent = (typeof RazorpayEvent)[keyof typeof RazorpayEvent];

/**
 * Order statuses an online payment event drives. These are a subset of the full
 * order lifecycle in `orderStatus.ts`; the production/dispatch stages live there.
 */
export const PaymentOrderStatus = {
  PENDING_PAYMENT: "PENDING_PAYMENT",
  PAYMENT_PROCESSING: "PAYMENT_PROCESSING",
  // Bank-transfer proof submitted, awaiting an admin review.
  PAYMENT_VERIFICATION_PENDING: "PAYMENT_SUBMITTED",
  PAID: "PAYMENT_VERIFIED", // authoritative paid state shared with bank-transfer flow
  PAYMENT_FAILED: "PAYMENT_FAILED",
  REFUNDED: "REFUNDED",
  CANCELLED: "CANCELLED",
} as const;
export type PaymentOrderStatus = (typeof PaymentOrderStatus)[keyof typeof PaymentOrderStatus];

/**
 * Order statuses from which it is still valid to capture an advance payment.
 * Mutable `string[]` (not `as const`) so it can be passed to Prisma `{ in: ... }`.
 */
export const PAYABLE_ORDER_STATUSES: string[] = [
  PaymentOrderStatus.PENDING_PAYMENT,
  PaymentOrderStatus.PAYMENT_PROCESSING,
  PaymentOrderStatus.PAYMENT_FAILED,
  "PAYMENT_REJECTED", // a rejected bank-transfer proof can be re-paid online
];
