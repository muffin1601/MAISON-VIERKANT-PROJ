import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { BRAND } from "@/lib/brand";

/**
 * Stamp the Maison Vierkant (Curated by Watcon) brand band onto EVERY page of an
 * existing PDF: the logo mark + wordmark on the left, contact details on the
 * right, over a legible cream footer band. The original file is never modified;
 * this returns a new PDF byte array.
 *
 * The logo mark is reproduced faithfully from public/logo.svg using pdf-lib
 * vector primitives (no rasterization), so it stays crisp at any zoom.
 */

// Palette (from the prototype design tokens).
const INK = rgb(0x1a / 255, 0x18 / 255, 0x14 / 255);
const GOLD = rgb(0x9a / 255, 0x7a / 255, 0x3a / 255);
const GOLD2 = rgb(0xc4 / 255, 0xa5 / 255, 0x5a / 255);
const CREAM = rgb(0xf8 / 255, 0xf5 / 255, 0xf0 / 255);
const CREAM3 = rgb(0xe0 / 255, 0xd9 / 255, 0xce / 255);

const BAND_H = 54; // footer band height (pt)
const MARGIN = 36;
const SP = String.fromCharCode(32); // guaranteed regular space
const VESSEL_PATH =
  "M20 26 h16 a2 2 0 0 1 2 2 v8 a10 10 0 0 1 -10 10 a10 10 0 0 1 -10 -10 v-8 a2 2 0 0 1 2 -2 z";

/** Drop any glyph the StandardFonts (WinAnsi) can't encode, so drawText never throws. */
function safe(text: string): string {
  let out = "";
  for (const ch of text) {
    const c = ch.codePointAt(0) ?? 0;
    if (c === 0x2022 || c === 0x2027 || c === 0x2219) out += "·"; // bullets -> middle dot
    else if (c <= 0xff) out += ch;
    else out += " ";
  }
  return out;
}

export async function stampCataloguePdf(input: Uint8Array): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(input, { ignoreEncryption: true });
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);

  for (const page of pdf.getPages()) {
    drawFooter(page, serif, sans);
  }
  return pdf.save();
}

function drawFooter(page: PDFPage, serif: PDFFont, sans: PDFFont) {
  const { width } = page.getSize();

  // Legible band so the brand reads over any underlying content.
  page.drawRectangle({ x: 0, y: 0, width, height: BAND_H, color: CREAM, opacity: 0.96 });
  page.drawRectangle({ x: 0, y: BAND_H - 0.75, width, height: 0.75, color: GOLD2 });

  // ---- Logo mark (reproduced from logo.svg, scaled) ----
  const s = 0.5; // 44pt square -> 22pt
  const ax = MARGIN; // page x of svg x=6 (mark left)
  const ay = (BAND_H - 44 * s) / 2; // vertically centered in the band

  // Outer square outline.
  page.drawRectangle({
    x: ax,
    y: ay,
    width: 44 * s,
    height: 44 * s,
    borderColor: GOLD2,
    borderWidth: 1.5 * s,
  });
  // Vessel glyph.
  page.drawSvgPath(VESSEL_PATH, {
    x: ax - 6 * s,
    y: ay + 58 * s,
    scale: s,
    borderColor: GOLD,
    borderWidth: 2 * s,
  });
  // Base line.
  page.drawLine({
    start: { x: ax + 11 * s, y: ay + 8 * s },
    end: { x: ax + 33 * s, y: ay + 8 * s },
    thickness: 2 * s,
    color: GOLD2,
  });

  // ---- Wordmark ----
  const textX = ax + 44 * s + 9;
  page.drawText(safe(BRAND.name), { x: textX, y: BAND_H / 2 + 1, size: 14, font: serif, color: INK });
  // Manual letter-spacing (pdf-lib has no letter-spacing option).
  page.drawText(safe(BRAND.tagline.split("").join(SP)), {
    x: textX + 1,
    y: BAND_H / 2 - 11,
    size: 6,
    font: sans,
    color: GOLD,
  });

  // ---- Contact details (right-aligned) ----
  const lines: { text: string; size: number; font: PDFFont; color: typeof INK }[] = [
    { text: safe(BRAND.email), size: 8.5, font: sans, color: INK },
    { text: safe(BRAND.phone), size: 8.5, font: sans, color: INK },
    { text: safe(BRAND.location), size: 7, font: sans, color: GOLD },
  ];
  let y = BAND_H - 16;
  for (const ln of lines) {
    const w = ln.font.widthOfTextAtSize(ln.text, ln.size);
    page.drawText(ln.text, { x: width - MARGIN - w, y, size: ln.size, font: ln.font, color: ln.color });
    y -= ln.size + 3;
  }

  // Decorative divider on the band's right edge.
  page.drawRectangle({ x: width - MARGIN - 0.5, y: 10, width: 0.5, height: BAND_H - 20, color: CREAM3 });
}
