import { NextResponse } from "next/server";
import { requirePermission, AuthError } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { productFromText, ExtractionError } from "@/services/extraction/PdfExtractionService";
import { toFormPatch } from "@/validations/pdfImport";

export const runtime = "nodejs";

const MAX_TEXT_CHARS = 200_000; // generous cap; text is extracted client-side

/** Map an extraction failure code to an HTTP status + safe message. */
function statusFor(code: ExtractionError["code"]): { status: number; message: string } {
  switch (code) {
    case "NO_TEXT":
      return {
        status: 422,
        message: "Could not read text from this PDF. It may be empty, corrupted, or image-only.",
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
 * Authenticated product extraction. Accepts JSON `{ text }` — the PDF's text layer (plus any
 * client-side OCR) already extracted in the browser. Returns the structured product and a
 * ready-to-apply form patch. The PDF itself is never uploaded here (see client image/doc flow).
 */
export async function POST(req: Request) {
  let user;
  try {
    user = await requirePermission("products.write");
  } catch (e) {
    const status = e instanceof AuthError && e.code === "UNAUTHENTICATED" ? 401 : 403;
    return NextResponse.json({ error: { message: "Not authorized" } }, { status });
  }

  let body: { text?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid request body" } }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.slice(0, MAX_TEXT_CHARS) : "";

  try {
    const product = productFromText(text);
    const patch = toFormPatch(product);

    void recordAudit({
      actorId: user.id,
      action: "product.import_pdf",
      entity: "Product",
      entityId: null,
      after: { name: patch.name, models: patch.models.length },
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
