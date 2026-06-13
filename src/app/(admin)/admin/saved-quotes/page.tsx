import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { SavedQuotesView, type SavedQuote } from "@/features/quotes/SavedQuotesView";

export const dynamic = "force-dynamic";

async function loadQuotes(): Promise<SavedQuote[]> {
  try {
    const quotes = await prisma.quote.findMany({
      include: {
        customer: true,
        items: { include: { product: { select: { name: true, code: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });
    return quotes.map((q) => ({
      id: q.id,
      number: q.number,
      date: q.createdAt.toISOString().slice(0, 10),
      customer: q.customer?.name ?? "—",
      company: q.customer?.company ?? "",
      email: q.customer?.email ?? "",
      phone: q.customer?.phone ?? "",
      status: q.status,
      subtotal: Number(q.subtotalInr),
      total: Number(q.totalInr),
      items: q.items.map((it) => ({
        name: it.product?.name ?? "—",
        code: it.product?.code ?? "",
        variantCode: it.variantCode ?? "",
        finish: it.finish,
        qty: it.qty,
        unit: Number(it.unitPriceInr),
      })),
    }));
  } catch {
    return [];
  }
}

export default async function SavedQuotesPage() {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.permissions, "quotes.read")) {
    return (
      <div className="a-page active">
        <div className="a-title">Saved Quotes</div>
        <div className="a-sub">You do not have access to quotes.</div>
      </div>
    );
  }

  const quotes = await loadQuotes();
  const canApprove = hasPermission(user.permissions, "quotes.approve");

  return (
    <div className="a-page active">
      <div className="a-title">Saved Quotes</div>
      <div className="a-sub">All your saved quotations — sort, search, edit, preview or download</div>
      <SavedQuotesView quotes={quotes} canApprove={canApprove} />
    </div>
  );
}
