/**
 * Single source of truth for the offline-payment order lifecycle.
 *
 * Customer flow:
 *   PENDING_PAYMENT → PAYMENT_SUBMITTED → PAYMENT_VERIFIED → IN_PRODUCTION
 *     → READY_TO_DISPATCH → DISPATCHED → DELIVERED
 *   (PENDING_PAYMENT → CANCELLED at any point before verification)
 *   PAYMENT_REJECTED routes the customer back to re-submit (treated like PENDING_PAYMENT).
 *
 * Legacy statuses (PENDING/CONFIRMED/…) are kept ONLY so historical orders created by
 * the old gateway flow still render; new orders never use them.
 */

export interface OrderStatusMeta {
  key: string;
  label: string; // human label shown to customer + admin
  color: string; // hex used for badges
  /** Lifecycle stage index for progress UIs (-1 = not part of the linear flow). */
  step: number;
  legacy?: boolean;
}

export const ORDER_STATUS_FLOW = [
  "PENDING_PAYMENT",
  "PAYMENT_SUBMITTED",
  "PAYMENT_VERIFIED",
  "IN_PRODUCTION",
  "READY_TO_DISPATCH",
  "DISPATCHED",
  "DELIVERED",
] as const;

export const ORDER_STATUS_META: Record<string, OrderStatusMeta> = {
  PENDING_PAYMENT:   { key: "PENDING_PAYMENT",   label: "Pending Payment",    color: "#a07a2a", step: 0 },
  PAYMENT_SUBMITTED: { key: "PAYMENT_SUBMITTED", label: "Payment Submitted",  color: "#1565c0", step: 1 },
  PAYMENT_VERIFIED:  { key: "PAYMENT_VERIFIED",  label: "Payment Verified",   color: "#2e7d32", step: 2 },
  IN_PRODUCTION:     { key: "IN_PRODUCTION",     label: "In Production",      color: "#6a4a1a", step: 3 },
  READY_TO_DISPATCH: { key: "READY_TO_DISPATCH", label: "Ready to Dispatch",  color: "#7a5cc0", step: 4 },
  DISPATCHED:        { key: "DISPATCHED",        label: "Dispatched",         color: "#1565c0", step: 5 },
  DELIVERED:         { key: "DELIVERED",         label: "Delivered",          color: "#2e7d32", step: 6 },
  CANCELLED:         { key: "CANCELLED",         label: "Cancelled",          color: "#b71c1c", step: -1 },
  PAYMENT_REJECTED:  { key: "PAYMENT_REJECTED",  label: "Payment Rejected",   color: "#b71c1c", step: 0 },
  // ---- legacy (display only) ----
  PENDING:    { key: "PENDING",    label: "Pending",    color: "#a07a2a", step: -1, legacy: true },
  CONFIRMED:  { key: "CONFIRMED",  label: "Confirmed",  color: "#2e7d32", step: -1, legacy: true },
  PROCESSING: { key: "PROCESSING", label: "Processing", color: "#1565c0", step: -1, legacy: true },
  SHIPPED:    { key: "SHIPPED",    label: "Shipped",    color: "#1565c0", step: -1, legacy: true },
  REFUNDED:   { key: "REFUNDED",   label: "Refunded",   color: "#6a1b9a", step: -1, legacy: true },
};

/** Statuses an admin can assign via the order-status control (excludes legacy + payment-driven). */
export const ADMIN_ASSIGNABLE_STATUSES = [
  "PENDING_PAYMENT",
  "PAYMENT_VERIFIED",
  "IN_PRODUCTION",
  "READY_TO_DISPATCH",
  "DISPATCHED",
  "DELIVERED",
  "CANCELLED",
] as const;

export function statusMeta(status: string): OrderStatusMeta {
  return (
    ORDER_STATUS_META[status?.toUpperCase()] ?? {
      key: status,
      label: status,
      color: "#6b6b6b",
      step: -1,
    }
  );
}

export function statusLabel(status: string): string {
  return statusMeta(status).label;
}
