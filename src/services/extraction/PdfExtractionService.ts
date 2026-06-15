/**
 * Server-side PDF → product extraction for the admin "Import From PDF" feature.
 * 100% free / offline — no AI service, no network, no recurring cost.
 *
 * Pipeline:
 *   1. pdf-parse    — pull embedded text + tables out of the PDF.
 *   2. tesseract.js — OCR fallback when the PDF has little/no embedded text (scanned pages).
 *                     Page rasters are rendered client-side (pdfjs-dist) and posted up, so the
 *                     server never needs a native canvas.
 *   3. parseProductText — deterministic regex/label/table parsing into the product shape.
 *
 * Every stage is defensive: a failure in parsing or OCR never throws past the caller without a
 * clear, typed error, and partial text still flows downstream.
 */
import { PDFParse } from "pdf-parse";
import { createWorker, type Worker } from "tesseract.js";
import type { ImportedProduct } from "@/validations/pdfImport";
import { parseProductText, hasUsableData } from "./parseProductText";

/** Below this many characters of embedded text we treat the PDF as scanned and try OCR. */
const MIN_TEXT_CHARS = 60;
const MAX_OCR_IMAGES = 12;

/** PNG/JPEG page raster for OCR fallback — a Buffer or a base64 / data-URL string. */
export type OcrImage = Buffer | string;

export interface ExtractInput {
  pdfBuffer: Buffer;
  /** Optional page rasters (rendered client-side) used only when embedded text is thin. */
  ocrImages?: OcrImage[];
}

export class ExtractionError extends Error {
  constructor(
    message: string,
    readonly code: "NO_TEXT" | "NO_DATA",
  ) {
    super(message);
    this.name = "ExtractionError";
  }
}

/** pdf-parse text extraction. Returns "" on any parse failure (corrupt/encrypted PDFs). */
async function extractText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return (result.text ?? "").trim();
  } catch {
    return "";
  } finally {
    await parser.destroy().catch(() => {});
  }
}

let ocrWorker: Worker | null = null;
let ocrWorkerInit: Promise<Worker> | null = null;

async function getOcrWorker(): Promise<Worker> {
  if (ocrWorker) return ocrWorker;
  if (!ocrWorkerInit) {
    ocrWorkerInit = createWorker("eng").then((w) => {
      ocrWorker = w;
      return w;
    });
  }
  return ocrWorkerInit;
}

/** OCR a set of page images. Best-effort — individual page failures are skipped. */
async function ocrImages(images: OcrImage[]): Promise<string> {
  const picked = images.slice(0, MAX_OCR_IMAGES);
  let worker: Worker;
  try {
    worker = await getOcrWorker();
  } catch {
    return ""; // worker/lang-data init failed — degrade gracefully
  }
  const out: string[] = [];
  for (const img of picked) {
    try {
      const { data } = await worker.recognize(img);
      if (data.text?.trim()) out.push(data.text.trim());
    } catch {
      /* skip this page */
    }
  }
  return out.join("\n\n").trim();
}

/**
 * Full pipeline: PDF bytes (+ optional OCR page rasters) → structured product.
 * Throws ExtractionError with a machine-readable `code` the route maps to an HTTP status.
 */
export async function extractProductFromPdf(input: ExtractInput): Promise<ImportedProduct> {
  let text = await extractText(input.pdfBuffer);

  // Scanned / image-only PDF → fall back to OCR over the client-rendered page rasters.
  if (text.length < MIN_TEXT_CHARS && input.ocrImages?.length) {
    const ocr = await ocrImages(input.ocrImages);
    if (ocr) text = [text, ocr].filter(Boolean).join("\n\n");
  }

  if (text.trim().length < MIN_TEXT_CHARS) {
    throw new ExtractionError(
      "Could not read any text from this PDF (it may be empty, corrupted, or image-only without OCR).",
      "NO_TEXT",
    );
  }

  const product = parseProductText(text);
  if (!hasUsableData(product)) {
    throw new ExtractionError("No recognisable product fields were found in this PDF.", "NO_DATA");
  }
  return product;
}
