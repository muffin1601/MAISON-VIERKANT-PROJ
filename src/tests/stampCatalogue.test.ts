import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { stampCataloguePdf } from "@/services/pdf/stampCatalogue";

async function makePdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([595, 842]); // A4
  return doc.save();
}

describe("stampCataloguePdf", () => {
  it("stamps every page and returns a valid PDF", async () => {
    const input = await makePdf(3);
    const out = await stampCataloguePdf(input);

    // Valid PDF signature.
    expect(Buffer.from(out.slice(0, 5)).toString()).toBe("%PDF-");

    // Page count preserved, and content was added (output larger than input).
    const reloaded = await PDFDocument.load(out);
    expect(reloaded.getPageCount()).toBe(3);
    expect(out.byteLength).toBeGreaterThan(input.byteLength);
  });

  it("handles a single-page document", async () => {
    const out = await stampCataloguePdf(await makePdf(1));
    const reloaded = await PDFDocument.load(out);
    expect(reloaded.getPageCount()).toBe(1);
  });
});
