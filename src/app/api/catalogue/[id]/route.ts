import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stampCataloguePdf } from "@/services/pdf/stampCatalogue";

/**
 * Serve a product catalogue/document PDF branded with the Maison Vierkant
 * (Curated by Watcon) logo + contact details on every page.
 *
 * Resolves by ProductDocument id (never by an arbitrary URL → no SSRF). The
 * original stored file is fetched, stamped on the fly, and streamed inline. If
 * the file isn't a stampable PDF (or stamping fails), we redirect to the
 * original so the link never breaks.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const doc = await prisma.productDocument.findUnique({ where: { id } });
  if (!doc) {
    return NextResponse.json({ error: { message: "Document not found" } }, { status: 404 });
  }

  const isPdf =
    doc.mimeType?.includes("pdf") || doc.url.toLowerCase().split("?")[0].endsWith(".pdf");

  try {
    const upstream = await fetch(doc.url);
    if (!upstream.ok) throw new Error(`upstream ${upstream.status}`);

    // Non-PDF (e.g. an image) → can't stamp; just proxy the original.
    if (!isPdf) return NextResponse.redirect(doc.url);

    const original = new Uint8Array(await upstream.arrayBuffer());
    const stamped = await stampCataloguePdf(original);

    const safeName = (doc.filename || "catalogue.pdf").replace(/[^\w.\-]+/g, "_");
    return new NextResponse(Buffer.from(stamped), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${safeName}"`,
        // Branded output is deterministic for a given source → allow caching.
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    // Never break the link — fall back to the unstamped original.
    return NextResponse.redirect(doc.url);
  }
}
