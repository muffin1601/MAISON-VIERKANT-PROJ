import { describe, it, expect } from "vitest";
import { productFromText, ExtractionError } from "@/services/extraction/PdfExtractionService";

const SHEET = `ARON
Collection: U Series
Material: Clay
Available colours: Natural Clay, White, Anthracite
Width: 40 cm
Height: 80 cm
Depth: 40 cm
Weight: 12 kg

AU80  h=80cm  € 1.299,00
AU60  h=60cm  € 748`;

describe("productFromText (free/deterministic, parses client-extracted text)", () => {
  it("parses extracted text into a structured product", () => {
    const product = productFromText(SHEET);
    expect(product.name).toBe("ARON");
    expect(product.series).toBe("U Series");
    expect(product.material).toBe("Clay");
    expect(product.finishes).toContain("Natural Clay");
    expect(product.variants?.map((v) => v.code)).toEqual(expect.arrayContaining(["AU80", "AU60"]));
    expect(product.variants?.find((v) => v.code === "AU80")?.eur).toBe(1299);
  });

  it("throws NO_TEXT when there is no usable text", () => {
    expect(() => productFromText("")).toThrowError(ExtractionError);
    try {
      productFromText("  \n  ");
    } catch (e) {
      expect((e as ExtractionError).code).toBe("NO_TEXT");
    }
  });

  it("throws NO_DATA when text is present but holds no product fields", () => {
    try {
      productFromText("—— ==== //// ____ ++++ #### @@@@ %%%% &&&& **** ()() <><> ;;;; :::: |||| ~~~~");
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ExtractionError);
      expect((e as ExtractionError).code).toBe("NO_DATA");
    }
  });
});
