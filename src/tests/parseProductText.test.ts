import { describe, it, expect } from "vitest";
import { parseProductText, hasUsableData } from "@/services/extraction/parseProductText";

const SHEET = `LEDA
Collection: 2025 Collection
Article No: LD-200
Material: Oak
Available colours: White, Taupe Grey
Width: 90 cm
Height: 45 cm
Depth: 90 cm
Weight: 18,5 kg
Description: A low oak coffee table with a sculpted solid top.
- Solid oak construction
- Water-based finish

LD90  90 x 45 x 90 cm  € 2.450,00
LD120 120 x 45 x 90 cm € 2,990`;

describe("parseProductText", () => {
  const p = parseProductText(SHEET);

  it("detects the product name and series", () => {
    expect(p.name).toBe("LEDA");
    expect(p.series).toBe("2025 Collection");
  });

  it("detects material and colours", () => {
    expect(p.material).toBe("Oak");
    expect(p.finishes).toEqual(expect.arrayContaining(["White", "Taupe Grey"]));
  });

  it("detects labelled dimensions and weight", () => {
    expect(p.dimensions?.width).toBe("90 cm");
    expect(p.dimensions?.height).toBe("45 cm");
    expect(p.dimensions?.depth).toBe("90 cm");
    expect(p.dimensions?.weight).toBe("18.5 kg");
  });

  it("extracts the SKU into specifications", () => {
    expect(p.specifications?.[0]).toEqual({ label: "SKU", value: "LD-200" });
  });

  it("captures bullet features as specifications", () => {
    const features = p.specifications?.filter((s) => s.label === "Feature").map((s) => s.value);
    expect(features).toEqual(expect.arrayContaining(["Solid oak construction", "Water-based finish"]));
  });

  it("parses variant rows with codes, dims and EUR prices (both number formats)", () => {
    const ld90 = p.variants?.find((v) => v.code === "LD90");
    const ld120 = p.variants?.find((v) => v.code === "LD120");
    expect(ld90?.eur).toBe(2450);
    expect(ld120?.eur).toBe(2990);
    expect(ld90?.dims).toMatch(/90.*45.*90/);
  });

  it("uses the labelled description and derives SEO fields", () => {
    expect(p.description).toContain("low oak coffee table");
    expect(p.seoTitle).toBe("LEDA");
    expect((p.seoDescription ?? "").length).toBeGreaterThan(0);
  });

  it("falls back to the longest prose paragraph when no Description label exists", () => {
    const text = "WIDGET\nSome spec: 1\nThis is a genuinely descriptive sentence about the widget and what it does well.";
    const r = parseProductText(text);
    expect(r.description).toContain("descriptive sentence about the widget");
  });

  it("parses a compact W x H x D triple when no dimension labels are present", () => {
    const r = parseProductText("BOX\n80 x 40 x 40 cm");
    expect(r.dimensions?.width).toBe("80 cm");
    expect(r.dimensions?.depth).toBe("40 cm");
  });

  it("parses an Atelier-Vierkant style table (name+size models, no prices)", () => {
    const text = [
      "ADAMAS",
      "b a h",
      "a b h w",
      "Adamas 60 82cm 87,5cm 64cm 70kg",
      "Adamas 70 94cm 97,5cm 73cm 80kg",
      'Adamas 60 32,3" 34,4" 25,2" 154lbs',
      'Adamas 70 37" 39,5" 28,7" 176lbs',
      "ateliervierkant.com",
    ].join("\n");
    const r = parseProductText(text);
    expect(r.name).toBe("ADAMAS");
    const codes = r.variants?.map((v) => v.code);
    expect(codes).toEqual(expect.arrayContaining(["ADAMAS 60", "ADAMAS 70"]));
    const a60 = r.variants?.find((v) => v.code === "ADAMAS 60");
    expect(a60?.dims).toContain("82cm");
    expect(a60?.dims).toContain("70kg");
    // No prose in the sheet → a clean description is synthesised, not the flattened table.
    expect(r.description).toContain("ADAMAS");
    expect(r.description).toContain("Available in 2 sizes");
    expect(r.description).not.toContain("82cm");
  });

  it("hasUsableData distinguishes real content from noise", () => {
    expect(hasUsableData(p)).toBe(true);
    expect(hasUsableData(parseProductText("———— //// ===="))).toBe(false);
  });
});
