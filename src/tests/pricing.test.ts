import { describe, it, expect } from "vitest";
import { calcBreakdown, calcINR, DEFAULT_PRICING } from "@/services/pricing/PricingService";

/**
 * Golden test: locks the pricing engine to the prototype's exact output.
 * Hand-computed for €1000 with default config (rate 93.5, disc 0, transport 18,
 * packing 1500, duty 25, gst 18, profit 25):
 *   inrBase=93500 → +18% =110330 → +1500 =111830 → +25% =139787.5
 *   → +18% =164949.25 → +25% =206186.5625 → round =206187
 */
describe("PricingService.calcBreakdown", () => {
  it("matches the prototype formula for €1000 at defaults", () => {
    const b = calcBreakdown(1000, DEFAULT_PRICING);
    expect(b.inrBase).toBe(93500);
    expect(b.withTransport).toBeCloseTo(110330, 2);
    expect(b.withPacking).toBeCloseTo(111830, 2);
    expect(b.withDuty).toBeCloseTo(139787.5, 2);
    expect(b.withGst).toBeCloseTo(164949.25, 2);
    expect(b.selling).toBe(206187);
  });

  it("applies discount before FX conversion", () => {
    const b = calcBreakdown(1000, { ...DEFAULT_PRICING, discountPct: 10 });
    expect(b.afterDisc).toBe(900);
    expect(b.inrBase).toBe(84150);
  });

  it("applies dealer markup as a final multiplier", () => {
    const base = calcINR(1000, DEFAULT_PRICING);
    const dealer = calcINR(1000, { ...DEFAULT_PRICING, dealerMarkupPct: 10 });
    expect(dealer).toBeGreaterThan(base);
  });

  it("packing is a flat add, not a percentage", () => {
    const a = calcBreakdown(0, DEFAULT_PRICING);
    expect(a.withPacking - a.withTransport).toBe(1500);
  });
});
