/**
 * Customer-facing checkout charges — the single source of truth for the order-summary
 * breakdown so every surface (checkout UI, server session, invoice, account, emails)
 * computes the SAME numbers.
 *
 * Model (all figures INR):
 *   subtotal   = Σ(unit price × qty)        // displayed product prices, treated as GST-exclusive
 *   packaging  = ₹30,000 × total quantity   // flat crate/handling per unit
 *   gst        = round(subtotal × 18%)       // output GST, charged on the subtotal only
 *   grandTotal = subtotal + packaging + gst  // (coupon discount, if any, is applied on top)
 *
 * There is deliberately NO duty line: import duty is already embedded in the landed
 * product price by PricingService and is never charged again at checkout.
 */

/** Flat packaging / crating charge levied per unit ordered. */
export const PACKAGING_PER_UNIT_INR = 30_000;

/** Output GST rate charged to the customer, as a percentage. */
export const GST_RATE_PCT = 18;

/** Packaging charge for a given total quantity (₹30,000 × qty). */
export function packagingInr(totalQty: number): number {
  return PACKAGING_PER_UNIT_INR * Math.max(0, Math.round(totalQty));
}

/** GST (18%) computed on the ex-GST subtotal. */
export function gstOnSubtotal(subtotalInr: number): number {
  return Math.round(subtotalInr * (GST_RATE_PCT / 100));
}
