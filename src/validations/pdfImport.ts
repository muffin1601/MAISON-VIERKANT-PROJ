import { z } from "zod";

/**
 * Contract for the AI-extracted product data returned by the PDF-import route, plus
 * sanitisation and a mapper onto the existing Product Create/Edit form fields.
 *
 * The product schema in `product.ts` is the source of truth for what is editable
 * (series, name, description, SEO, finishes, models[code/eur/dims]). This file maps
 * the richer extracted shape onto those fields — it does NOT add new product columns.
 */

/** Strip HTML/control chars and clamp length. Defence-in-depth before anything is shown or saved. */
export function sanitizeText(input: unknown, max = 4000): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/<[^>]*>/g, " ") // drop any HTML tags
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "") // control chars (keep tab/CR/LF)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function sanitizeList(arr: unknown, maxItems: number, maxLen = 80): string[] {
  if (!Array.isArray(arr)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of arr) {
    const v = sanitizeText(raw, maxLen);
    const key = v.toLowerCase();
    if (v && !seen.has(key)) {
      seen.add(key);
      out.push(v);
    }
    if (out.length >= maxItems) break;
  }
  return out;
}

/** Coerce "12,5 cm" / "€ 1.299,00" / "1299" → number, else undefined. */
function toNumber(input: unknown): number | undefined {
  if (typeof input === "number" && Number.isFinite(input)) return input;
  if (typeof input !== "string") return undefined;
  const cleaned = input.replace(/[^0-9.,-]/g, "").replace(/\.(?=\d{3}\b)/g, ""); // strip thousands dots
  const normalized = cleaned.replace(",", ".");
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : undefined;
}

const variantSchema = z.object({
  code: z.string().optional().nullable(),
  dims: z.string().optional().nullable(),
  eur: z.union([z.number(), z.string()]).optional().nullable(),
});

const specSchema = z.object({
  label: z.string().optional().nullable(),
  value: z.string().optional().nullable(),
});

/** What the model is asked to return. Everything optional — PDFs vary wildly. */
export const importedProductSchema = z.object({
  name: z.string().optional().nullable(),
  series: z.string().optional().nullable(), // a.k.a. category / collection
  shortDescription: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  material: z.string().optional().nullable(),
  seoTitle: z.string().optional().nullable(),
  seoDescription: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
  finishes: z.array(z.string()).optional().nullable(), // colours / finishes
  dimensions: z
    .object({
      width: z.string().optional().nullable(),
      height: z.string().optional().nullable(),
      depth: z.string().optional().nullable(),
      weight: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
  variants: z.array(variantSchema).optional().nullable(),
  specifications: z.array(specSchema).optional().nullable(),
});

export type ImportedProduct = z.infer<typeof importedProductSchema>;

/** Compose a human dimensions string from the structured object (e.g. "W 40 · H 80 · D 40 · 12 kg"). */
function dimsString(d: ImportedProduct["dimensions"]): string {
  if (!d) return "";
  const parts: string[] = [];
  if (d.width) parts.push(`W ${sanitizeText(d.width, 30)}`);
  if (d.height) parts.push(`H ${sanitizeText(d.height, 30)}`);
  if (d.depth) parts.push(`D ${sanitizeText(d.depth, 30)}`);
  if (d.weight) parts.push(sanitizeText(d.weight, 30));
  return parts.join(" · ");
}

/** The subset of editable form fields the import can populate. Images are handled separately. */
export interface ImportFormPatch {
  series: string;
  name: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
  finishes: string[];
  models: { code: string; eur: number; dims: string }[];
}

/**
 * Map the (already-validated) extracted product onto the existing form fields, sanitising
 * everything on the way. Fields with no source data come back empty so callers can decide
 * (Replace / Merge / Skip) what to do with them.
 */
export function toFormPatch(raw: ImportedProduct): ImportFormPatch {
  // Description is only the real prose from the PDF (short + long). Specifications are NOT
  // folded in — if the PDF has no description paragraph, the field stays empty.
  const descParts = [
    sanitizeText(raw.shortDescription, 600),
    sanitizeText(raw.description, 3000),
  ].filter(Boolean);

  // Finishes = explicit finishes + material (material is a colour-like attribute here).
  const finishes = sanitizeList(
    [...(raw.finishes ?? []), ...(raw.material ? [raw.material] : [])],
    20,
  );

  // Variants → models. Fall back to a single model built from the dimensions block.
  const baseDims = dimsString(raw.dimensions);
  let models = (raw.variants ?? [])
    .map((v) => ({
      code: sanitizeText(v?.code, 40),
      dims: sanitizeText(v?.dims, 120) || baseDims,
      eur: toNumber(v?.eur) ?? 0,
    }))
    .filter((m) => m.code || m.dims || m.eur > 0)
    .slice(0, 50);

  if (models.length === 0 && baseDims) {
    models = [{ code: "", dims: baseDims, eur: 0 }];
  }

  return {
    series: sanitizeText(raw.series, 120),
    name: sanitizeText(raw.name, 120),
    description: descParts.join("\n\n").slice(0, 4000),
    seoTitle: sanitizeText(raw.seoTitle, 120),
    seoDescription: sanitizeText(raw.seoDescription, 320),
    finishes,
    models,
  };
}
