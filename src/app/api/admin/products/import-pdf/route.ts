import { NextResponse } from "next/server";
import { requirePermission, AuthError } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { extractProductFromPdf, ExtractionError } from "@/services/extraction/PdfExtractionService";
import { toFormPatch } from "@/validations/pdfImport";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_PDF_BYTES = 50 * 1024 * 1024; // 50 MB (feature spec)
const MAX_OCR_PAGES = 12;

/** Map an extraction failure code to an HTTP status + safe message. */
function statusFor(code: ExtractionError["code"]): { status: number; message: string } {
  switch (code) {
    case "NO_TEXT":
      return {
        status: 422,
        message:
          "Could not read this PDF. It may be empty, corrupted, or a scanned image we couldn't OCR.",
      };
    case "NO_DATA":
      return {
        status: 422,
        message: "We read the PDF but couldn't find recognisable product fields to import.",
      };
    default:
      return { status: 500, message: "Import failed." };
  }
}

/**
 * Authenticated PDF → product extraction. Accepts multipart form:
 *   - `file`  : the product PDF (required, ≤ 50 MB, application/pdf)
 *   - `pages` : 0..N rendered page images (PNG/JPEG) used only for OCR fallback
 * Returns the structured product and a ready-to-apply form patch.
 */
export async function POST(req: Request) {
  let user;
  try {
    user = await requirePermission("products.write");
  } catch (e) {
    const status = e instanceof AuthError && e.code === "UNAUTHENTICATED" ? 401 : 403;
    return NextResponse.json({ error: { message: "Not authorized" } }, { status });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: { message: "Invalid form submission" } }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: { message: "No PDF uploaded" } }, { status: 400 });
  }
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: { message: "File must be a PDF" } }, { status: 415 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: { message: "PDF is empty" } }, { status: 400 });
  }
  if (file.size > MAX_PDF_BYTES) {
    return NextResponse.json({ error: { message: "PDF exceeds the 50 MB limit" } }, { status: 413 });
  }

  const pdfBuffer = Buffer.from(await file.arrayBuffer());

  // Optional OCR page rasters (only consumed if embedded text is thin).
  const pageEntries = form.getAll("pages").filter((p): p is File => p instanceof File);
  const ocrImages: Buffer[] = [];
  for (const p of pageEntries.slice(0, MAX_OCR_PAGES)) {
    if (p.type.startsWith("image/") && p.size > 0) {
      ocrImages.push(Buffer.from(await p.arrayBuffer()));
    }
  }

  try {
    const product = await extractProductFromPdf({ pdfBuffer, ocrImages });
    const patch = toFormPatch(product);

    // Best-effort audit; never block the response on it.
    void recordAudit({
      actorId: user.id,
      action: "product.import_pdf",
      entity: "Product",
      entityId: null,
      after: { filename: file.name, size: file.size, name: patch.name },
    }).catch(() => {});

    return NextResponse.json({ data: { product, patch } });
  } catch (e) {
    if (e instanceof ExtractionError) {
      const { status, message } = statusFor(e.code);
      return NextResponse.json({ error: { message } }, { status });
    }
    return NextResponse.json({ error: { message: "Import failed unexpectedly." } }, { status: 500 });
  }
}
