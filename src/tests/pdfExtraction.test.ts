import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock pdf-parse (native pdfjs under the hood) so the service is unit-testable offline.
const { parseMock } = vi.hoisted(() => ({ parseMock: vi.fn() }));

vi.mock("pdf-parse", () => ({
  PDFParse: class {
    getText() {
      return parseMock();
    }
    async destroy() {}
  },
}));

import { extractProductFromPdf, ExtractionError } from "@/services/extraction/PdfExtractionService";

const pdf = Buffer.from("%PDF-1.4 fake");

const SHEET = `ARON
Collection: U Series
Material: Clay
Available colours: Natural Clay, White, Anthracite
Width: 40 cm
Height: 80 cm
Depth: 40 cm
Weight: 12 kg
A sculptural hand-thrown clay vessel for interior styling.

AU80  h=80cm  € 1.299,00
AU60  h=60cm  € 748`;

describe("extractProductFromPdf (free/deterministic)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("parses embedded PDF text into a structured product", async () => {
    parseMock.mockResolvedValueOnce({ text: SHEET });
    const product = await extractProductFromPdf({ pdfBuffer: pdf });
    expect(product.name).toBe("ARON");
    expect(product.series).toBe("U Series");
    expect(product.material).toBe("Clay");
    expect(product.finishes).toContain("Natural Clay");
    expect(product.variants?.map((v) => v.code)).toEqual(expect.arrayContaining(["AU80", "AU60"]));
    expect(product.variants?.find((v) => v.code === "AU80")?.eur).toBe(1299);
  });

  it("throws NO_TEXT for an unreadable PDF with no OCR images", async () => {
    parseMock.mockResolvedValueOnce({ text: "" });
    await expect(extractProductFromPdf({ pdfBuffer: pdf })).rejects.toMatchObject({
      name: "ExtractionError",
      code: "NO_TEXT",
    });
  });

  it("throws NO_DATA when text is present but holds no product fields", async () => {
    parseMock.mockResolvedValueOnce({ text: "—— ==== //// ____ ++++ #### @@@@ %%%% &&&& **** ()() <><> ;;;; :::: |||| ~~~~ ^^^^ ???? !!!!" });
    await expect(extractProductFromPdf({ pdfBuffer: pdf })).rejects.toMatchObject({ code: "NO_DATA" });
  });

  it("recovers (returns '') when pdf-parse throws on a corrupt PDF, then reports NO_TEXT", async () => {
    parseMock.mockRejectedValueOnce(new Error("bad xref"));
    await expect(extractProductFromPdf({ pdfBuffer: pdf })).rejects.toBeInstanceOf(ExtractionError);
  });
});
