/** INR formatter — identical to prototype `fmt` (₹ + en-IN grouping). */
export function fmt(n: number): string {
  return "₹" + Number(Math.round(n)).toLocaleString("en-IN");
}

/** EUR formatter — identical to prototype `fmtE`. */
export function fmtE(n: number): string {
  return "€" + Number(n).toLocaleString();
}

/** Deterministic slug matching the seed's slugify. */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
