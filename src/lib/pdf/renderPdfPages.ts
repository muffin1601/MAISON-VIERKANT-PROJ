"use client";

/**
 * Browser-side PDF processing (pdfjs-dist). Extracts the text layer AND rasterises pages to
 * web-friendly WEBP images — all in the browser. This keeps large PDFs off the server entirely
 * (Vercel's serverless body limit is 4.5 MB): only the small extracted text is posted to the
 * API for parsing, while page images go through the existing image-upload flow. Yields between
 * pages so the UI never freezes.
 */
// pdfjs-dist is imported DYNAMICALLY (below), never at module scope. Although this is a
// "use client" module, Next still evaluates it on the server during SSR — and pdfjs touches
// browser-only globals (DOMMatrix) at import time, which throws in Node. Loading it lazily inside
// the client-only functions keeps it off the server entirely.
type PdfjsModule = typeof import("pdfjs-dist");

let pdfjs: PdfjsModule | null = null;
let workerReady = false;

/** Load pdfjs once (client only) and configure its worker. */
async function loadPdfjs(): Promise<PdfjsModule> {
  if (pdfjs) return pdfjs;
  const mod = await import("pdfjs-dist");
  if (!workerReady) {
    try {
      mod.GlobalWorkerOptions.workerPort = new Worker(
        new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url),
        { type: "module" },
      );
    } catch {
      mod.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
    }
    workerReady = true;
  }
  pdfjs = mod;
  return mod;
}

export interface RenderedPage {
  page: number;
  file: File;
  dataUrl: string;
  /** "embedded" = a real image object lifted from the PDF; "page" = full-page fallback render. */
  kind: "embedded" | "page";
}

/** Skip images smaller than this on their longer edge (icons, logos, bullets, watermarks). */
const MIN_EMBEDDED_EDGE = 180;
/** Clamp very large embedded images so uploads stay reasonable. */
const MAX_EMBEDDED_EDGE = 2200;

export interface RenderOptions {
  maxPages?: number;
  /** Max pages to pull text from (text is cheap, so we cover more than we rasterise). */
  maxTextPages?: number;
  /** Target raster width in px (height scales to aspect). */
  targetWidth?: number;
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

export interface PdfExtract {
  pages: RenderedPage[];
  text: string;
}

const DEFAULTS = { maxPages: 12, maxTextPages: 30, targetWidth: 1400 };

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read rendered page"));
    reader.readAsDataURL(blob);
  });
}

/** Cheap content fingerprint (length + sampled bytes) to drop duplicate/blank pages. */
async function fingerprint(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let hash = buf.length >>> 0;
  const step = Math.max(1, Math.floor(buf.length / 512));
  for (let i = 0; i < buf.length; i += step) {
    hash = (hash * 31 + buf[i]) >>> 0;
  }
  return `${buf.length}:${hash}`;
}

type PdfImageObject = {
  width: number;
  height: number;
  kind?: number; // pdfjs ImageKind: 1 GRAYSCALE_8BPP · 2 RGB_24BPP · 3 RGBA_32BPP
  data?: Uint8ClampedArray | Uint8Array;
  bitmap?: CanvasImageSource;
};

/** Resolve a pdfjs object by id (image XObjects load asynchronously) without throwing. */
function getPdfObject(objs: { get(id: string, cb: (v: unknown) => void): void }, id: string): Promise<PdfImageObject | null> {
  return new Promise((resolve) => {
    try {
      objs.get(id, (v) => resolve((v as PdfImageObject) ?? null));
    } catch {
      resolve(null);
    }
  });
}

/** Paint a pdfjs image object (ImageBitmap or raw pixel buffer) onto a canvas → WEBP blob. */
async function imageObjectToBlob(img: PdfImageObject): Promise<Blob | null> {
  const { width, height } = img;
  if (!width || !height) return null;
  if (Math.max(width, height) < MIN_EMBEDDED_EDGE) return null; // decorative / icon

  const scale = Math.min(1, MAX_EMBEDDED_EDGE / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);

  if (img.bitmap) {
    ctx.drawImage(img.bitmap, 0, 0, w, h);
  } else if (img.data) {
    const src = img.data;
    const rgba = new Uint8ClampedArray(width * height * 4);
    if (img.kind === 3 && src.length >= width * height * 4) {
      rgba.set(src.subarray(0, rgba.length));
    } else if (img.kind === 2 && src.length >= width * height * 3) {
      for (let i = 0, j = 0; i < width * height; i++) {
        rgba[j++] = src[i * 3]; rgba[j++] = src[i * 3 + 1]; rgba[j++] = src[i * 3 + 2]; rgba[j++] = 255;
      }
    } else if (img.kind === 1 && src.length >= width * height) {
      for (let i = 0; i < width * height; i++) {
        const v = src[i]; rgba[i * 4] = v; rgba[i * 4 + 1] = v; rgba[i * 4 + 2] = v; rgba[i * 4 + 3] = 255;
      }
    } else {
      return null; // unsupported (e.g. 1-bpp mask) — leave to the page fallback
    }
    // Put at native size on an offscreen canvas, then scale onto the target.
    const full = document.createElement("canvas");
    full.width = width; full.height = height;
    const fctx = full.getContext("2d");
    if (!fctx) return null;
    fctx.putImageData(new ImageData(rgba, width, height), 0, 0);
    ctx.drawImage(full, 0, 0, w, h);
  } else {
    return null;
  }

  return new Promise((res) => canvas.toBlob((b) => res(b), "image/webp", 0.9));
}

type PdfObjStore = { get(id: string, cb: (v: unknown) => void): void };
type PdfPageLike = {
  getOperatorList: () => Promise<{ fnArray: number[]; argsArray: unknown[][] }>;
  objs: PdfObjStore;
  commonObjs: PdfObjStore;
};

/** Pull the embedded raster images referenced by a page's draw operations. */
async function extractEmbeddedImages(
  page: PdfPageLike,
  OPS: Record<string, number | undefined>,
): Promise<PdfImageObject[]> {
  let opList;
  try {
    opList = await page.getOperatorList();
  } catch {
    return [];
  }
  const found: PdfImageObject[] = [];
  const seenIds = new Set<string>();
  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    const args = opList.argsArray[i];
    if (fn === OPS.paintImageXObject || fn === OPS.paintJpegXObject) {
      const id = args?.[0];
      if (typeof id !== "string" || seenIds.has(id)) continue;
      seenIds.add(id);
      const obj =
        (await getPdfObject(page.objs, id)) ??
        (await getPdfObject(page.commonObjs, id));
      if (obj) found.push(obj);
    } else if (fn === OPS.paintInlineImageXObject) {
      const obj = args?.[0] as PdfImageObject | undefined;
      if (obj?.width) found.push(obj);
    }
  }
  return found;
}

/**
 * Extract the text layer and product images in a single pdfjs pass. For each page we first try
 * to lift the real embedded images; if a page has none usable, we fall back to a full-page
 * render so nothing is missed. Throws on an unreadable/corrupt PDF. Deduplicates identical images.
 */
export async function extractPdf(
  pdf: File | ArrayBuffer,
  opts: RenderOptions = {},
): Promise<PdfExtract> {
  if (typeof window === "undefined") return { pages: [], text: "" };
  const pdfjsLib = await loadPdfjs();
  const OPS = pdfjsLib.OPS as unknown as Record<string, number | undefined>;
  const { maxPages, maxTextPages, targetWidth } = { ...DEFAULTS, ...opts };
  const data = pdf instanceof ArrayBuffer ? pdf : await pdf.arrayBuffer();

  const loadingTask = pdfjsLib.getDocument({ data: data.slice(0) });
  const doc = await loadingTask.promise;
  try {
    const imgTotal = Math.min(doc.numPages, maxPages);
    const textTotal = Math.min(doc.numPages, maxTextPages);
    const total = Math.max(imgTotal, textTotal);
    const out: RenderedPage[] = [];
    const textChunks: string[] = [];
    const seen = new Set<string>();

    for (let n = 1; n <= total; n++) {
      if (opts.signal?.aborted) break;
      const page = await doc.getPage(n);

      // 1 · Text layer (cheap) — preserves line breaks between vertical groups.
      if (n <= textTotal) {
        try {
          const tc = await page.getTextContent();
          const chunk = tc.items
            .map((it) => ("str" in it ? it.str : ""))
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();
          if (chunk) textChunks.push(chunk);
        } catch {
          /* page has no text layer — OCR fallback may cover it */
        }
      }

      // 2 · Images (only for the first maxPages pages): prefer embedded photos, else full page.
      if (n <= imgTotal) {
        const pushBlob = async (blob: Blob, kind: RenderedPage["kind"], idx: number) => {
          const fp = await fingerprint(blob);
          if (seen.has(fp)) return;
          seen.add(fp);
          const file = new File([blob], `page-${n}-${kind}-${idx}.webp`, { type: "image/webp" });
          out.push({ page: n, file, dataUrl: await blobToDataUrl(blob), kind });
        };

        // 2a · Embedded raster images.
        let embeddedCount = 0;
        const images = await extractEmbeddedImages(page, OPS);
        for (let k = 0; k < images.length; k++) {
          const blob = await imageObjectToBlob(images[k]);
          if (blob) {
            const before = out.length;
            await pushBlob(blob, "embedded", k);
            if (out.length > before) embeddedCount++;
          }
        }

        // 2b · Full-page fallback when the page yielded no usable embedded image.
        if (embeddedCount === 0) {
          const base = page.getViewport({ scale: 1 });
          const scale = Math.min(2.5, Math.max(0.5, targetWidth / base.width));
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            await page.render({ canvasContext: ctx, viewport, canvas }).promise;
            const blob: Blob | null = await new Promise((res) =>
              canvas.toBlob((b) => res(b), "image/webp", 0.9),
            );
            if (blob) await pushBlob(blob, "page", 0);
          }
        }
      }

      page.cleanup();
      opts.onProgress?.(n, total);
      // Yield to the event loop so a long catalogue doesn't lock the UI thread.
      await new Promise((r) => setTimeout(r, 0));
    }
    return { pages: out, text: textChunks.join("\n") };
  } finally {
    void loadingTask.destroy();
  }
}

/**
 * Client-side OCR fallback (tesseract.js) for scanned/image-only PDFs with no text layer.
 * Dynamically imported so it only loads when actually needed; failures degrade to "". Free —
 * the wasm/lang assets are fetched from the public CDN, no API key, no recurring cost.
 */
export async function ocrPages(
  pages: RenderedPage[],
  opts: { maxPages?: number; onProgress?: (done: number, total: number) => void } = {},
): Promise<string> {
  if (typeof window === "undefined" || pages.length === 0) return "";
  const picked = pages.slice(0, opts.maxPages ?? 8);
  try {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng");
    try {
      const chunks: string[] = [];
      for (let i = 0; i < picked.length; i++) {
        try {
          const { data } = await worker.recognize(picked[i].dataUrl);
          if (data.text?.trim()) chunks.push(data.text.trim());
        } catch {
          /* skip this page */
        }
        opts.onProgress?.(i + 1, picked.length);
      }
      return chunks.join("\n\n").trim();
    } finally {
      await worker.terminate().catch(() => {});
    }
  } catch {
    return ""; // tesseract unavailable in this environment — degrade gracefully
  }
}
