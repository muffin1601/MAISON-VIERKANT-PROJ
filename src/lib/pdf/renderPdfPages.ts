"use client";

/**
 * Browser-side PDF page rasteriser (pdfjs-dist). Renders each page to a web-friendly WEBP/PNG
 * image used both as candidate product photos (uploaded through the existing upload flow) and
 * as the OCR fallback source for the server. Runs entirely in the browser so the server needs
 * no native canvas; yields between pages so the UI never freezes.
 */
import * as pdfjsLib from "pdfjs-dist";

/**
 * Configure the pdfjs worker lazily and ONCE, on the client only. A real module Worker via
 * `new Worker(new URL(...))` is the pattern webpack/Next bundle reliably; we fall back to a
 * plain workerSrc string if Worker construction is unavailable. Done lazily (not at module
 * scope) so it never runs during SSR of this client component.
 */
let workerReady = false;
function ensureWorker() {
  if (workerReady || typeof window === "undefined") return;
  try {
    pdfjsLib.GlobalWorkerOptions.workerPort = new Worker(
      new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url),
      { type: "module" },
    );
  } catch {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
  }
  workerReady = true;
}

export interface RenderedPage {
  page: number;
  file: File;
  dataUrl: string;
}

export interface RenderOptions {
  maxPages?: number;
  /** Target raster width in px (height scales to aspect). */
  targetWidth?: number;
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

const DEFAULTS = { maxPages: 12, targetWidth: 1400 };

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

/**
 * Render up to `maxPages` pages to image Files. Throws on an unreadable/corrupt PDF so the
 * caller can show a clear error. Deduplicates identical pages.
 */
export async function renderPdfPages(
  pdf: File | ArrayBuffer,
  opts: RenderOptions = {},
): Promise<RenderedPage[]> {
  if (typeof window === "undefined") return [];
  ensureWorker();
  const { maxPages, targetWidth } = { ...DEFAULTS, ...opts };
  const data = pdf instanceof ArrayBuffer ? pdf : await pdf.arrayBuffer();

  const loadingTask = pdfjsLib.getDocument({ data: data.slice(0) });
  const doc = await loadingTask.promise;
  try {
    const total = Math.min(doc.numPages, maxPages);
    const out: RenderedPage[] = [];
    const seen = new Set<string>();

    for (let n = 1; n <= total; n++) {
      if (opts.signal?.aborted) break;
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(2.5, Math.max(0.5, targetWidth / base.width));
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        page.cleanup();
        continue;
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;

      const blob: Blob | null = await new Promise((res) =>
        canvas.toBlob((b) => res(b), "image/webp", 0.9),
      );
      page.cleanup();
      if (!blob) continue;

      const fp = await fingerprint(blob);
      if (seen.has(fp)) {
        opts.onProgress?.(n, total);
        continue;
      }
      seen.add(fp);

      const file = new File([blob], `page-${n}.webp`, { type: "image/webp" });
      out.push({ page: n, file, dataUrl: await blobToDataUrl(blob) });
      opts.onProgress?.(n, total);

      // Yield to the event loop so a long catalogue doesn't lock the UI thread.
      await new Promise((r) => setTimeout(r, 0));
    }
    return out;
  } finally {
    void loadingTask.destroy();
  }
}
