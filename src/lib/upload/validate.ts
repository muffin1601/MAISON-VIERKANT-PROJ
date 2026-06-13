/**
 * Shared server-side upload rules. One place for buckets, MIME allow-lists and size caps,
 * reused by every upload route (audit C-2). Each "category" maps to a Supabase bucket.
 */

export const IMAGE_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
] as const;

export const PDF_MIME = ["application/pdf"] as const;

export const DOC_MIME = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
] as const;

// CAD / technical drawing formats (validated by extension where MIME is unreliable).
export const CAD_MIME = [
  "application/acad",
  "image/vnd.dwg",
  "image/vnd.dxf",
  "application/dxf",
  "model/step",
  "application/octet-stream", // many CAD files report this; gated by extension below
] as const;
export const CAD_EXT = ["dwg", "dxf", "step", "stp", "iges", "igs", "stl"];

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB
export const MAX_DOC_BYTES = 25 * 1024 * 1024; // 25 MB
export const MAX_PDF_BYTES = 25 * 1024 * 1024;
export const MAX_CAD_BYTES = 50 * 1024 * 1024;

/** Upload categories → Supabase bucket + rules. `category` is what clients send. */
export type UploadCategory = "product-image" | "drawing" | "document" | "catalogue" | "price-list";

export interface CategoryRule {
  bucket: string;
  allowed: readonly string[];
  exts?: readonly string[]; // optional extra extension allow-list (for octet-stream CAD)
  maxBytes: number;
  folder: string;
}

export const CATEGORY_RULES: Record<UploadCategory, CategoryRule> = {
  "product-image": { bucket: "products-images", allowed: IMAGE_MIME, maxBytes: MAX_IMAGE_BYTES, folder: "products" },
  drawing: {
    bucket: "drawings",
    allowed: [...IMAGE_MIME, ...PDF_MIME, ...CAD_MIME],
    exts: CAD_EXT,
    maxBytes: MAX_CAD_BYTES,
    folder: "drawings",
  },
  document: { bucket: "product-documents", allowed: DOC_MIME, maxBytes: MAX_DOC_BYTES, folder: "documents" },
  catalogue: { bucket: "catalogues", allowed: DOC_MIME, maxBytes: MAX_DOC_BYTES, folder: "catalogues" },
  "price-list": { bucket: "uploads", allowed: PDF_MIME, maxBytes: MAX_PDF_BYTES, folder: "price-lists" },
};

export interface UploadValidation {
  ok: boolean;
  status: number;
  message?: string;
}

function extOf(name: string): string {
  return name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
}

/** Validate a `File` against a category rule (MIME allow-list, optional ext allow-list, max size). */
export function validateForCategory(file: unknown, rule: CategoryRule): UploadValidation {
  if (!(file instanceof File)) return { ok: false, status: 400, message: "No file uploaded" };
  if (file.size === 0) return { ok: false, status: 400, message: "Empty file" };
  if (file.size > rule.maxBytes) {
    return { ok: false, status: 413, message: `File exceeds ${Math.round(rule.maxBytes / 1048576)} MB limit` };
  }
  const mimeOk = rule.allowed.includes(file.type);
  const extOk = rule.exts ? rule.exts.includes(extOf(file.name)) : false;
  if (!mimeOk && !extOk) {
    return { ok: false, status: 415, message: `Unsupported type "${file.type || extOf(file.name) || "unknown"}"` };
  }
  return { ok: true, status: 200 };
}

/** Build a safe, collision-resistant object key. `unique` should be a UUID supplied by the caller. */
export function buildObjectKey(folder: string, originalName: string, unique: string): string {
  const ext = extOf(originalName).replace(/[^a-z0-9]/g, "") || "bin";
  const base =
    originalName
      .replace(/\.[^.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "file";
  return `${folder}/${unique}-${base}.${ext}`;
}
