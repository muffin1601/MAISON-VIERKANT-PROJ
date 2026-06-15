import { describe, it, expect } from "vitest";
import { calcBreakdown, calcINR, calcINRnoGst, DEFAULT_PRICING } from "@/services/pricing/PricingService";

/**
 * Corrected import-costing model: landed cost → margin → output GST.
 * Hand-computed for €1000 at defaults (rate 93.5, disc 0, transport 18, packing 1500,
 * duty 25, sws 0, gst 18, profit 25):
 *   inrBase=93500 → CIF=110330 → duty=27582.5 → landed=110330+27582.5+1500=139412.5
 *   sellingExGst=139412.5×1.25=174265.625 → GST=31367.8125 → selling=round=205633
 */
describe("PricingService.calcBreakdown", () => {
  it("builds landed cost then margin then GST for €1000 at defaults", () => {
    const b = calcBreakdown(1000, DEFAULT_PRICING);
    expect(b.inrBase).toBe(93500);
    expect(b.cif).toBeCloseTo(110330, 2);
    expect(b.duty).toBeCloseTo(27582.5, 2);
    expect(b.landed).toBeCloseTo(139412.5, 2);
    expect(b.sellingExGst).toBeCloseTo(174265.625, 2);
    expect(b.outputGst).toBeCloseTo(31367.8125, 2);
    expect(b.selling).toBe(205633);
  });

  it("applies GST after margin (never marks up tax with profit)", () => {
    const b = calcBreakdown(1000, DEFAULT_PRICING);
    // selling == sellingExGst + GST, and GST == sellingExGst × gst%
    expect(b.outputGst).toBeCloseTo(b.sellingExGst * 0.18, 4);
    expect(b.selling).toBe(Math.round(b.sellingExGst * 1.18));
  });

  it("does not run packing through duty or GST (added flat to landed cost)", () => {
    const withPack = calcBreakdown(1000, DEFAULT_PRICING);
    const noPack = calcBreakdown(1000, { ...DEFAULT_PRICING, packingFlat: 0 });
    // Landed differs by exactly the packing amount — not amplified by duty/GST/profit.
    expect(withPack.landed - noPack.landed).toBe(1500);
  });

  it("applies Social Welfare Surcharge as a % of duty", () => {
    const b = calcBreakdown(1000, { ...DEFAULT_PRICING, swsPct: 10 });
    expect(b.sws).toBeCloseTo(b.duty * 0.1, 4);
  });

  it("applies supplier discount before FX conversion", () => {
    const b = calcBreakdown(1000, { ...DEFAULT_PRICING, discountPct: 10 });
    expect(b.afterDisc).toBe(900);
    expect(b.inrBase).toBe(84150);
  });

  it("applies dealer markup as an extra multiplier on the margin", () => {
    const base = calcINR(1000, DEFAULT_PRICING);
    const dealer = calcINR(1000, { ...DEFAULT_PRICING, dealerMarkupPct: 10 });
    expect(dealer).toBeGreaterThan(base);
  });

  it("calcINRnoGst returns the pre-GST selling price", () => {
    const b = calcBreakdown(1000, DEFAULT_PRICING);
    expect(calcINRnoGst(1000, DEFAULT_PRICING)).toBe(Math.round(b.sellingExGst));
  });
});
