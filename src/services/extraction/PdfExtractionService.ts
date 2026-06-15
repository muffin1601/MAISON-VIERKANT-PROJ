/**
 * Server-side product extraction for the admin "Import From PDF" feature.
 * 100% free / offline — no AI service, no network, no recurring cost.
 *
 * Text (and any OCR) is produced in the BROWSER with pdfjs-dist / tesseract.js, so the server
 * receives only the already-extracted text — never the (potentially 50 MB) PDF. That keeps the
 * route well under serverless body limits and free of heavy native server deps. Here we just run
 * the deterministic parser over that text.
 */
import type { ImportedProduct } from "@/validations/pdfImport";
import { parseProductText, hasUsableData } from "./parseProductText";

/** Below this many characters we treat the document as having no usable text. */
export const MIN_TEXT_CHARS = 40;

export class ExtractionError extends Error {
  constructor(
    message: string,
    readonly code: "NO_TEXT" | "NO_DATA",
  ) {
    super(message);
    this.name = "ExtractionError";
  }
}

/**
 * Parse client-extracted PDF text into a structured product.
 * Throws ExtractionError with a machine-readable `code` the route maps to an HTTP status.
 */
export function productFromText(text: string): ImportedProduct {
  if (!text || text.trim().length < MIN_TEXT_CHARS) {
    throw new ExtractionError(
      "Could not read any text from this PDF (it may be empty, corrupted, or image-only).",
      "NO_TEXT",
    );
  }
  const product = parseProductText(text);
  if (!hasUsableData(product)) {
    throw new ExtractionError("No recognisable product fields were found in this PDF.", "NO_DATA");
  }
  return product;
}
