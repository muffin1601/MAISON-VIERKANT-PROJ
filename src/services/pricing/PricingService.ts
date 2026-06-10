/**
 * PricingService — single source of truth for EUR → INR pricing.
 * The staged formula is preserved EXACTLY from the prototype (calcBreakdown):
 *   afterDisc     = eur * (1 - discount/100)
 *   inrBase       = afterDisc * rate
 *   withTransport = inrBase * (1 + transport/100)
 *   withPacking   = withTransport + packingFlat
 *   withDuty      = withPacking * (1 + duty/100)
 *   withGst       = withDuty * (1 + gst/100)
 *   selling       = round(withGst * (1 + profit/100))   // final INR
 * Dealer markup (B2B quotes only) is applied as a final multiplier when provided.
 */
export interface PricingConfig {
  rate: number; // FX EUR -> INR
  discountPct: number;
  transportPct: number;
  packingFlat: number;
  dutyPct: number;
  gstPct: number;
  profitPct: number;
  dealerMarkupPct?: number;
}

export interface PriceBreakdown {
  eur: number;
  afterDisc: number;
  inrBase: number;
  withTransport: number;
  withPacking: number;
  withDuty: number;
  withGst: number;
  selling: number; // final INR (rounded)
}

export const DEFAULT_PRICING: PricingConfig = {
  rate: 93.5,
  discountPct: 0,
  transportPct: 18,
  packingFlat: 1500,
  dutyPct: 25,
  gstPct: 18,
  profitPct: 25,
  dealerMarkupPct: 0,
};

export function calcBreakdown(eur: number, c: PricingConfig): PriceBreakdown {
  const afterDisc = eur * (1 - c.discountPct / 100);
  const inrBase = afterDisc * c.rate;
  const withTransport = inrBase * (1 + c.transportPct / 100);
  const withPacking = withTransport + c.packingFlat;
  const withDuty = withPacking * (1 + c.dutyPct / 100);
  const withGst = withDuty * (1 + c.gstPct / 100);
  const dealer = 1 + (c.dealerMarkupPct ?? 0) / 100;
  const selling = Math.round(withGst * (1 + c.profitPct / 100) * dealer);
  return { eur, afterDisc, inrBase, withTransport, withPacking, withDuty, withGst, selling };
}

/** Final INR selling price for a EUR amount. */
export function calcINR(eur: number, c: PricingConfig = DEFAULT_PRICING): number {
  return calcBreakdown(eur, c).selling;
}

/** Pre-GST INR (mirrors prototype calcINRnoG): excludes GST and profit. */
export function calcINRnoGst(eur: number, c: PricingConfig = DEFAULT_PRICING): number {
  const afterDisc = eur * (1 - c.discountPct / 100);
  const inrBase = afterDisc * c.rate;
  const withTransport = inrBase * (1 + c.transportPct / 100);
  return Math.round(withTransport + c.packingFlat);
}
