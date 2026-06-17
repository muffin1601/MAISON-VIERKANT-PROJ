/**
 * Parse an uploaded price list (Excel .xlsx/.xls OR .csv) into {code, eur} rows.
 *
 * Accepts the real-world export the admin uses: a sheet with a `MODEL` column and a
 * `PRICE_EUR` column (header names are auto-detected, case-insensitively, in any
 * column order). Falls back to "first column = model, second = price" when no header
 * is recognised. Thousands separators / currency symbols in the price are stripped.
 *
 * SheetJS is imported dynamically so the ~600 kB parser only loads when an Excel file
 * is actually chosen — it never touches the initial admin bundle.
 */
export interface ParsedPriceList {
  entries: { code: string; eur: number }[];
  totalRows: number; // data rows considered (excludes header)
  modelHeader: string | null;
  priceHeader: string | null;
}

const MODEL_RE = /^(model|model\s*(no\.?|number)|code|sku|article|item)$/i;
const PRICE_RE = /(price|eur|amount|cost|rate)/i;

function cell(v: unknown): string {
  return v === null || v === undefined ? "" : String(v).trim();
}

function toEur(raw: string): number {
  // Keep digits and a single decimal separator; strip ₹/€/commas/spaces/text.
  const cleaned = raw.replace(/,/g, "").replace(/[^0-9.]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

async function readRows(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase();
  const isExcel = name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".xlsm");

  if (isExcel) {
    const XLSX = await import("xlsx");
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) return [];
    const json = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: "" });
    return json.map((row) => (Array.isArray(row) ? row.map(cell) : []));
  }

  // CSV / TSV / plain text
  const text = await file.text();
  return text
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0)
    .map((line) => line.split(/[,;\t]/).map((s) => s.trim().replace(/^"|"$/g, "")));
}

export async function parsePriceList(file: File): Promise<ParsedPriceList> {
  const rows = await readRows(file);
  if (rows.length === 0) {
    return { entries: [], totalRows: 0, modelHeader: null, priceHeader: null };
  }

  // Locate the header row + the model/price columns by name (scan the first few rows).
  let modelCol = -1;
  let priceCol = -1;
  let headerIdx = -1;
  let modelHeader: string | null = null;
  let priceHeader: string | null = null;

  for (let r = 0; r < Math.min(rows.length, 5); r++) {
    const row = rows[r];
    let mc = -1;
    let pc = -1;
    for (let c = 0; c < row.length; c++) {
      const v = row[c];
      if (mc === -1 && MODEL_RE.test(v)) mc = c;
      else if (pc === -1 && PRICE_RE.test(v)) pc = c;
    }
    if (mc !== -1 && pc !== -1) {
      headerIdx = r;
      modelCol = mc;
      priceCol = pc;
      modelHeader = row[mc];
      priceHeader = row[pc];
      break;
    }
  }

  // Fallback: no recognised header → assume col0 = model, col1 = price, no header row.
  if (headerIdx === -1) {
    modelCol = 0;
    priceCol = 1;
  }

  const dataStart = headerIdx === -1 ? 0 : headerIdx + 1;
  const seen = new Map<string, number>(); // last value wins on duplicates
  let totalRows = 0;

  for (let r = dataStart; r < rows.length; r++) {
    const row = rows[r];
    const code = cell(row[modelCol]);
    const eur = toEur(cell(row[priceCol]));
    if (!code) continue;
    totalRows++;
    if (eur > 0) seen.set(code, eur);
  }

  const entries = Array.from(seen, ([code, eur]) => ({ code, eur }));
  return { entries, totalRows, modelHeader, priceHeader };
}
