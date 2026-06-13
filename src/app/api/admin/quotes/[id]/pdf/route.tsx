import { renderToBuffer } from "@react-pdf/renderer";
import { requirePermission, AuthError } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { QuotePdf, type QuotePdfData } from "@/services/quotes/QuotePdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Generate a fully-branded A4 PDF for a saved quote. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("quotes.read");
  } catch (e) {
    const status = e instanceof AuthError && e.code === "UNAUTHENTICATED" ? 401 : 403;
    return new Response("Not authorized", { status });
  }

  const { id } = await params;
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      customer: true,
      items: { include: { product: { select: { name: true, code: true } } } },
    },
  });
  if (!quote) return new Response("Quote not found", { status: 404 });

  const data: QuotePdfData = {
    number: quote.number,
    date: quote.createdAt.toISOString().slice(0, 10),
    customer: quote.customer?.name ?? "—",
    company: quote.customer?.company ?? "",
    email: quote.customer?.email ?? "",
    phone: quote.customer?.phone ?? "",
    status: quote.status,
    subtotal: Number(quote.subtotalInr),
    total: Number(quote.totalInr),
    items: quote.items.map((it) => ({
      name: it.product?.name ?? "—",
      code: it.product?.code ?? "",
      variantCode: it.variantCode ?? "",
      finish: it.finish,
      qty: it.qty,
      unit: Number(it.unitPriceInr),
    })),
  };

  const buffer = await renderToBuffer(<QuotePdf q={data} />);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${quote.number}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
