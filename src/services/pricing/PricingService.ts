/**
 * PricingService — single source of truth for EUR → INR pricing.
 *
 * Corrected import-costing model (landed cost → margin → output GST):
 *   afterDisc    = eur × (1 − discount/100)              // supplier trade discount (on EUR)
 *   inrBase      = afterDisc × rate                       // converted at FX rate
 *   cif          = inrBase × (1 + transport/100)          // freight + insurance ⇒ assessable value
 *   duty         = cif × duty/100                         // customs duty on CIF
 *   sws          = duty × sws/100                         // Social Welfare Surcharge (on duty)
 *   landed       = cif + duty + sws + packingFlat         // landed cost (packing is NOT duty-marked)
 *   sellingExGst = landed × (1 + profit/100) × (1 + dealerMarkup/100)  // margin on landed cost
 *   outputGst    = sellingExGst × gst/100                 // GST charged to the customer, applied LAST
 *   selling      = round(sellingExGst + outputGst)        // final customer price (GST-inclusive)
 *
 * Notes vs the old prototype formula (which this replaces):
 *   - GST is applied AFTER margin (on the selling price), never marked up by profit.
 *   - Packing is added to landed cost AFTER duty (not run through duty/GST/profit).
 *   - Import IGST paid at customs is recoverable (Input Tax Credit) and is intentionally NOT
 *     part of the cost base — only the customer-facing output GST is modelled here.
 */
export interface PricingConfig {
  rate: number; // FX EUR -> INR
  discountPct: number; // supplier trade discount on EUR
  transportPct: number; // freight + insurance, % of converted value
  packingFlat: number; // fixed packing/handling (INR), added to landed cost
  dutyPct: number; // customs duty on CIF
  swsPct?: number; // Social Welfare Surcharge, % of duty (default 0)
  gstPct: number; // output GST charged to customer (applied last)
  profitPct: number; // margin on landed cost
  dealerMarkupPct?: number; // extra B2B markup (quotes), applied with margin
}

export interface PriceBreakdown {
  eur: number;
  afterDisc: number;
  inrBase: number;
  cif: number; // freight/insurance-inclusive assessable value
  duty: number;
  sws: number;
  landed: number; // landed cost (margin base)
  sellingExGst: number; // selling price before output GST
  outputGst: number;
  selling: number; // final customer price, GST-inclusive (rounded)
}

export const DEFAULT_PRICING: PricingConfig = {
  rate: 93.5,
  discountPct: 0,
  transportPct: 18,
  packingFlat: 1500,
  dutyPct: 25,
  swsPct: 0,
  gstPct: 18,
  profitPct: 25,
  dealerMarkupPct: 0,
};

export function calcBreakdown(eur: number, c: PricingConfig): PriceBreakdown {
  const afterDisc = eur * (1 - c.discountPct / 100);
  const inrBase = afterDisc * c.rate;
  const cif = inrBase * (1 + c.transportPct / 100);
  const duty = cif * (c.dutyPct / 100);
  const sws = duty * ((c.swsPct ?? 0) / 100);
  const landed = cif + duty + sws + c.packingFlat;
  const dealer = 1 + (c.dealerMarkupPct ?? 0) / 100;
  const sellingExGst = landed * (1 + c.profitPct / 100) * dealer;
  const outputGst = sellingExGst * (c.gstPct / 100);
  const selling = Math.round(sellingExGst + outputGst);
  return { eur, afterDisc, inrBase, cif, duty, sws, landed, sellingExGst, outputGst, selling };
}

/** Final customer INR price for a EUR amount (GST-inclusive). */
export function calcINR(eur: number, c: PricingConfig = DEFAULT_PRICING): number {
  return calcBreakdown(eur, c).selling;
}

/** Selling price BEFORE output GST (useful for B2B/quotes that show GST as a separate line). */
export function calcINRnoGst(eur: number, c: PricingConfig = DEFAULT_PRICING): number {
  return Math.round(calcBreakdown(eur, c).sellingExGst);
}
