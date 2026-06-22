import fs from "node:fs";
import path from "node:path";

/** A single gallery image, ready to render. */
export interface GalleryImage {
  /** Sequential project number (natural order). */
  n: number;
  /** Public, URL-encoded src path. */
  src: string;
  /** Generated, descriptive alt text. */
  alt: string;
}

const GALLERY_DIR = path.join(process.cwd(), "public", "images");
// Only the curated project shots follow the `gallery-image (N).webp` convention.
const FILE_RE = /^gallery-image \((\d+)\)\.webp$/i;

/**
 * Reads every `.webp` project image from `public/images`, sorts it naturally
 * (1 → 2 → 10, not 1 → 10 → 2) and returns render-ready descriptors. Runs on the
 * server only — no manual arrays, no client filesystem access.
 *
 * Reads fresh from disk on every call so added/deleted images are reflected
 * immediately (the directory listing of a few hundred entries is negligible, and
 * in production the page is statically generated so this runs only at build).
 */
export function getGalleryImages(): GalleryImage[] {
  let files: string[] = [];
  try {
    files = fs.readdirSync(GALLERY_DIR);
  } catch {
    // Folder missing in some environments (e.g. partial deploys) — fail soft.
    return [];
  }

  const parsed = files
    .map((file) => {
      const m = file.match(FILE_RE);
      return m ? { file, fileNo: Number(m[1]) } : null;
    })
    .filter((x): x is { file: string; fileNo: number } => x !== null)
    .sort((a, b) => a.fileNo - b.fileNo);

  // Renumber sequentially (1..N) after sorting so deleted files leave no gaps in
  // the displayed project numbers — the on-disk filename keeps its original index.
  return parsed.map(({ file }, i) => {
    const n = i + 1;
    return {
      n,
      // encodeURI keeps `/` and `()` but escapes the space in the filename.
      src: encodeURI(`/images/${file}`),
      alt: `Maison Vierkant project ${String(n).padStart(3, "0")} — architectural and interior craftsmanship`,
    };
  });
}
