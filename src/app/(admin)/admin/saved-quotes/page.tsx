import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { fmt } from "@/lib/format";

export const dynamic = "force-dynamic";

async function loadQuotes() {
  try {
    const quotes = await prisma.quote.findMany({
      include: { customer: true, _count: { select: { items: true } } },
      orderBy: { createdAt: "desc" },
    });
    return quotes.map((q) => ({
      number: q.number,
      date: q.createdAt.toISOString().slice(0, 10),
      customer: q.customer?.name ?? "—",
      lines: q._count.items,
      total: Number(q.totalInr),
      status: q.status,
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

  return (
    <div className="a-page active">
      <div className="a-title">Saved Quotes</div>
      <div className="a-sub">All your saved quotations — sort, search, edit, preview or download</div>
      <div className="a-card" style={{ overflowX: "auto" }}>
        <table className="a-table">
          <thead>
            <tr>
              <th>Quote</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Lines</th>
              <th>Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {quotes.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ color: "var(--ink4)", fontSize: 12, padding: "14px 12px" }}>
                  No saved quotes yet. Create one from “Create Quote”.
                </td>
              </tr>
            ) : (
              quotes.map((q) => (
                <tr key={q.number}>
                  <td style={{ fontSize: 11, color: "var(--ink4)" }}>{q.number}</td>
                  <td style={{ color: "var(--ink3)" }}>{q.date}</td>
                  <td style={{ fontWeight: 400 }}>{q.customer}</td>
                  <td>{q.lines}</td>
                  <td style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 17 }}>
                    {fmt(q.total)}
                  </td>
                  <td>
                    <span className="sbadge s-confirmed">{q.status}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
