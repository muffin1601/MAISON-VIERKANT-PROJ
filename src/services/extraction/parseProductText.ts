/**
 * Deterministic product parser — zero AI, zero network, zero cost.
 *
 * Turns raw text (from pdf-parse, with a tesseract.js OCR fallback upstream) into the same
 * `ImportedProduct` shape the form mapper consumes. Pure regex / label / table heuristics, so
 * it is fully testable and free to run. Tuned for furniture/catalogue spec sheets but degrades
 * gracefully on arbitrary PDFs — unknown fields simply come back empty.
 */
import type { ImportedProduct } from "@/validations/pdfImport";

const KNOWN_MATERIALS = [
  "clay", "oak", "walnut", "teak", "ash", "beech", "pine", "mango wood", "wood",
  "stainless steel", "steel", "aluminium", "aluminum", "brass", "bronze", "iron", "metal",
  "ceramic", "porcelain", "glass", "leather", "linen", "cotton", "wool", "velvet", "fabric",
  "marble", "granite", "stone", "concrete", "terrazzo", "rattan", "bamboo", "cane", "jute",
];

const KNOWN_COLOURS = [
  "natural clay", "white", "off-white", "ivory", "cream", "beige", "sand", "taupe", "grey", "gray",
  "anthracite", "charcoal", "black", "brown", "terracotta", "rust", "red", "bordeaux", "burgundy",
  "orange", "yellow", "gold", "green", "olive", "sage", "blue", "navy", "teal", "cork", "nordic white",
];

/** Labels we treat as a field, longest/most-specific first so e.g. "short description" wins over "description". */
const LABELS = {
  name: ["product name", "article name", "model name", "name", "title", "product", "article"],
  sku: ["sku", "article no", "article number", "art. no", "art no", "item no", "item code", "model no", "model", "reference", "ref", "code", "item"],
  series: ["collection", "series", "range", "product line", "category", "product group"],
  shortDescription: ["short description", "summary", "subtitle", "tagline"],
  description: ["description", "details", "about", "product description"],
  material: ["materials", "material", "composition", "made of", "made from"],
  colours: ["available colours", "available colors", "colours", "colors", "finish", "finishes", "colour", "color"],
  weight: ["weight", "net weight", "gross weight"],
  width: ["width", "w"],
  height: ["height", "h"],
  depth: ["depth", "d"],
  diameter: ["diameter", "dia", "ø"],
  tags: ["tags", "keywords", "key words"],
};

type Lines = string[];

function clean(s: string): string {
  return s.replace(/ /g, " ").replace(/[\t ]+/g, " ").trim();
}

function normalize(raw: string): Lines {
  return raw
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map(clean)
    .filter((l) => l.length > 0);
}

/** Escape a label for safe use inside a RegExp. */
function rx(label: string): string {
  return label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Find the value for any of `labels`, matching "Label: value", "Label - value",
 * "Label = value", or a label on its own line with the value on the next line.
 */
function labelValue(lines: Lines, labels: string[]): string {
  for (const label of labels) {
    const inline = new RegExp(`^${rx(label)}\\s*[:\\-=]\\s*(.+)$`, "i");
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(inline);
      if (m && m[1].trim()) return clean(m[1]);
      // label alone on its own line → take the following non-empty line
      if (new RegExp(`^${rx(label)}\\s*:?$`, "i").test(lines[i]) && lines[i + 1]) {
        return clean(lines[i + 1]);
      }
    }
  }
  return "";
}

function looksLikeLabelLine(line: string): boolean {
  return /^[A-Za-z][\w .\/()-]{0,30}\s*[:\-=]\s*\S/.test(line);
}

/** A measurement token such as "80 cm", "12,5cm", "1.2 m", '40"'. */
const MEASURE = /(\d+(?:[.,]\d+)?)\s*(cm|mm|m|in|inch|")?/i;

function measure(value: string): string {
  const m = value.match(MEASURE);
  if (!m) return "";
  const unit = m[2] ? ` ${m[2].toLowerCase().replace("inch", "in")}` : "";
  return `${m[1].replace(",", ".")}${unit}`.trim();
}

function findName(lines: Lines): string {
  const labelled = labelValue(lines, LABELS.name);
  if (labelled) return labelled;
  // Otherwise: first short, letter-bearing line that is not itself a label or pure measurement.
  for (const l of lines.slice(0, 8)) {
    if (l.length >= 2 && l.length <= 70 && /[a-z]/i.test(l) && !looksLikeLabelLine(l) && !/^\d/.test(l)) {
      return l;
    }
  }
  // Last resort: first short, letter-bearing line (never a flattened spec/table row).
  return lines.find((l) => /[a-z]/i.test(l) && l.length <= 60) ?? "";
}

function findMaterial(lines: Lines, text: string): string {
  const labelled = labelValue(lines, LABELS.material);
  if (labelled) return labelled;
  const lower = text.toLowerCase();
  for (const mat of KNOWN_MATERIALS) {
    if (new RegExp(`\\b${rx(mat)}\\b`, "i").test(lower)) {
      return mat.replace(/\b\w/g, (c) => c.toUpperCase());
    }
  }
  return "";
}

function findColours(lines: Lines, text: string): string[] {
  const found = new Set<string>();
  const labelled = labelValue(lines, LABELS.colours);
  if (labelled) {
    for (const part of labelled.split(/[,;/|]/)) {
      const v = clean(part);
      if (v && v.length <= 40) found.add(v);
    }
  }
  const lower = text.toLowerCase();
  for (const c of KNOWN_COLOURS) {
    if (new RegExp(`\\b${rx(c)}\\b`, "i").test(lower)) {
      found.add(c.replace(/\b\w/g, (ch) => ch.toUpperCase()));
    }
  }
  return Array.from(found).slice(0, 20);
}

function findWeight(lines: Lines, text: string): string {
  const labelled = labelValue(lines, LABELS.weight);
  const source = labelled || text;
  const m = source.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|lbs?|kilograms?|grams?)\b/i);
  if (!m) return "";
  return `${m[1].replace(",", ".")} ${m[2].toLowerCase()}`;
}

function findDimensions(lines: Lines, text: string): ImportedProduct["dimensions"] {
  const dims: NonNullable<ImportedProduct["dimensions"]> = {};
  const w = labelValue(lines, LABELS.width);
  const h = labelValue(lines, LABELS.height);
  const d = labelValue(lines, LABELS.depth);
  const dia = labelValue(lines, LABELS.diameter);
  if (w) dims.width = measure(w);
  if (h) dims.height = measure(h);
  if (d) dims.depth = measure(d);
  if (dia && !dims.width) dims.width = measure(dia);

  // Fallback: a compact "80 x 40 x 40 cm" triple anywhere in the text.
  if (!dims.width && !dims.height && !dims.depth) {
    const m = text.match(
      /(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+(?:[.,]\d+)?)\s*(cm|mm|m|in|")?/i,
    );
    if (m) {
      const unit = m[4] ? ` ${m[4].toLowerCase()}` : "";
      dims.width = `${m[1].replace(",", ".")}${unit}`.trim();
      dims.height = `${m[2].replace(",", ".")}${unit}`.trim();
      dims.depth = `${m[3].replace(",", ".")}${unit}`.trim();
    }
  }
  return Object.keys(dims).length ? dims : undefined;
}

/** A printed EUR price → number, handling "€ 1.299,00", "1,299.00", "748". */
function parsePrice(line: string): number | undefined {
  const m = line.match(/(?:€|eur)\s*([\d.,]+)|([\d.,]+)\s*(?:€|eur)/i);
  if (!m) return undefined;
  const raw = (m[1] ?? m[2] ?? "").trim();
  if (!raw) return undefined;
  // Normalise thousands/decimal separators.
  let n = raw;
  if (/,\d{2}$/.test(n)) n = n.replace(/\./g, "").replace(",", "."); // 1.299,00 → 1299.00
  else n = n.replace(/,/g, ""); // 1,299 → 1299
  const val = parseFloat(n);
  return Number.isFinite(val) ? val : undefined;
}

const CODE_RX = /\b([A-Z]{1,6}\d{1,4}[A-Z0-9]*)\b/;
const TRIPLE_RX = /\d+(?:[.,]\d+)?\s*[x×*]\s*\d+(?:[.,]\d+)?(?:\s*[x×*]\s*\d+(?:[.,]\d+)?)?\s*(?:cm|mm|m)?/i;

/** Rows that carry a code and/or a price and/or dimensions become variants/models. */
function findVariants(lines: Lines): NonNullable<ImportedProduct["variants"]> {
  const out: NonNullable<ImportedProduct["variants"]> = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const eur = parsePrice(line);
    const code = line.match(CODE_RX)?.[1];
    const dims = line.match(TRIPLE_RX)?.[0];
    if (!code && eur === undefined) continue; // need at least a code or a price to be a row
    const key = `${code ?? ""}|${eur ?? ""}|${dims ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ code: code ?? "", dims: dims ? clean(dims) : "", eur: eur ?? 0 });
    if (out.length >= 60) break;
  }
  return out;
}

const BULLET_RX = /^\s*[-•*–▪·]\s+(.{2,})$/;

/** Bullet "features" + remaining "Label: value" lines become specifications. */
function findSpecs(lines: Lines, consumed: Set<string>): NonNullable<ImportedProduct["specifications"]> {
  const out: NonNullable<ImportedProduct["specifications"]> = [];
  for (const line of lines) {
    const bullet = line.match(BULLET_RX);
    if (bullet) {
      out.push({ label: "Feature", value: clean(bullet[1]) });
      continue;
    }
    const kv = line.match(/^([A-Za-z][\w .\/()-]{1,30})\s*[:\-=]\s*(.+)$/);
    if (kv) {
      const label = clean(kv[1]);
      const value = clean(kv[2]);
      if (consumed.has(label.toLowerCase()) || value.length > 200) continue;
      out.push({ label, value });
    }
    if (out.length >= 40) break;
  }
  return out;
}

/**
 * A paragraph is "prose" only if it reads like sentences — enough lowercase words and NOT
 * dominated by numbers/measurements (which is how spec tables flatten out of a PDF).
 */
function isProse(t: string): boolean {
  if (t.length < 40) return false;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length < 8) return false;
  const numeric = words.filter((w) => /\d/.test(w) || /^(cm|mm|kg|lbs?|g|in)$/i.test(w)).length;
  if (numeric / words.length > 0.22) return false; // mostly measurements → a table, not prose
  const lowerWords = words.filter((w) => /^[a-zà-ÿ]{3,}$/i.test(w)).length;
  return lowerWords >= 6;
}

function findDescription(lines: Lines, text: string): { description: string; shortDescription: string } {
  const shortDescription = labelValue(lines, LABELS.shortDescription);
  let description = labelValue(lines, LABELS.description);
  if (!description) {
    const paragraphs = text.replace(/\r\n?/g, "\n").split(/\n\s*\n/);
    let best = "";
    for (const p of paragraphs) {
      const t = clean(p.replace(/\n/g, " "));
      if (isProse(t) && t.length > best.length) best = t;
    }
    description = best;
  }
  return { description, shortDescription };
}

/** Compose a clean description from facts when the PDF has no usable prose (spec-sheet PDFs). */
function generateDescription(
  name: string,
  series: string,
  material: string,
  finishes: string[],
  variants: NonNullable<ImportedProduct["variants"]>,
): string {
  if (!name) return "";
  const sizes = variants.map((v) => v.code).filter(Boolean);
  let s = series ? `${name} from the ${series} collection` : name;
  if (material) s += `, crafted from ${material.toLowerCase()}`;
  s += ".";
  if (sizes.length) s += ` Available in ${sizes.length} size${sizes.length > 1 ? "s" : ""}: ${sizes.join(", ")}.`;
  if (finishes.length) s += ` Finishes: ${finishes.slice(0, 6).join(", ")}.`;
  return s;
}

/**
 * Detect variant/model rows by the product name + size pattern, e.g. "Adamas 60 82cm 87,5cm
 * 64cm 70kg" — codes that contain a space (so the generic code regex misses them). Measurement
 * tokens after each label become that model's dimensions; metric and imperial blocks merge.
 */
function findVariantsByName(text: string, name: string): NonNullable<ImportedProduct["variants"]> {
  const base = name.trim().split(/\s+/)[0];
  if (!base || base.length < 2) return [];
  const labelRx = new RegExp(`${rx(base)}\\s*\\d+[a-z]?`, "gi");
  const matches = [...text.matchAll(labelRx)];
  if (matches.length === 0) return [];

  const measureRx = /\d+(?:[.,]\d+)?\s*(?:cm|mm|m|kg|g|lbs?|inch|in|")/gi;
  const byCode = new Map<string, { code: string; tokens: string[] }>();
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : text.length;
    const code = clean(m[0]).replace(/\s+/g, " ").toUpperCase();
    const tokens = (text.slice(start, end).match(measureRx) ?? []).map((t) => clean(t));
    const entry = byCode.get(code) ?? { code, tokens: [] };
    for (const t of tokens) if (!entry.tokens.includes(t)) entry.tokens.push(t);
    byCode.set(code, entry);
  }
  return [...byCode.values()].map((e) => ({ code: e.code, dims: e.tokens.join(" · "), eur: 0 })).slice(0, 40);
}

function findTags(lines: Lines, series: string, material: string): string[] {
  const tags = new Set<string>();
  const labelled = labelValue(lines, LABELS.tags);
  if (labelled) for (const t of labelled.split(/[,;/|]/)) { const v = clean(t); if (v) tags.add(v); }
  if (series) tags.add(series);
  if (material) tags.add(material);
  return Array.from(tags).slice(0, 15);
}

/**
 * Parse raw extracted PDF text into a structured product. Always returns an object; callers
 * decide whether the result is "empty enough" to reject (see hasUsableData).
 */
export function parseProductText(raw: string): ImportedProduct {
  const text = raw ?? "";
  const lines = normalize(text);

  const name = findName(lines);
  const sku = labelValue(lines, LABELS.sku);
  const series = labelValue(lines, LABELS.series);
  const material = findMaterial(lines, text);
  const finishes = findColours(lines, text);
  const weight = findWeight(lines, text);
  const dimensions = findDimensions(lines, text);
  const { description: foundDescription, shortDescription } = findDescription(lines, text);

  // Prefer name+size variant rows (e.g. "Adamas 60 …"); fall back to generic code/price rows.
  const namedVariants = findVariantsByName(text, name);
  const variants = namedVariants.length ? namedVariants : findVariants(lines);

  // Use real prose if present, otherwise synthesise a clean description from the parsed facts.
  const description =
    foundDescription || generateDescription(name, series, material, finishes, variants);

  // Fields we don't want duplicated into the generic specifications list.
  const consumed = new Set(
    [...LABELS.name, ...LABELS.sku, ...LABELS.series, ...LABELS.description, ...LABELS.shortDescription,
     ...LABELS.material, ...LABELS.colours, ...LABELS.weight, ...LABELS.width, ...LABELS.height,
     ...LABELS.depth, ...LABELS.diameter, ...LABELS.tags].map((l) => l.toLowerCase()),
  );
  const specifications = findSpecs(lines, consumed);
  if (sku) specifications.unshift({ label: "SKU", value: sku });
  if (weight && !dimensions?.weight) specifications.push({ label: "Weight", value: weight });

  const dims = dimensions ? { ...dimensions, weight: dimensions.weight ?? weight ?? "" } : weight ? { weight } : undefined;

  const tags = findTags(lines, series, material);

  return {
    name,
    series,
    shortDescription,
    description,
    material,
    seoTitle: name,
    seoDescription: shortDescription || description.slice(0, 160),
    tags,
    finishes,
    dimensions: dims,
    variants,
    specifications,
  };
}

/** True when the parser found at least something worth filling the form with. */
export function hasUsableData(p: ImportedProduct): boolean {
  return Boolean(
    p.name?.trim() ||
    p.description?.trim() ||
    (p.variants && p.variants.length) ||
    (p.finishes && p.finishes.length) ||
    (p.specifications && p.specifications.length) ||
    p.dimensions,
  );
}
