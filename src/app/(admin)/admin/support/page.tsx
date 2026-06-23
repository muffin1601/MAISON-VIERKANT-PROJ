import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { SupportAdmin, type TicketRow } from "@/features/admin/SupportAdmin";

export const dynamic = "force-dynamic";

export default async function AdminSupportPage() {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.permissions, "leads.read")) {
    return (
      <div className="a-page active">
        <div className="a-title">Support &amp; Returns</div>
        <div className="a-sub">You do not have access to support tickets.</div>
      </div>
    );
  }

  const tickets = await prisma.supportTicket.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  const rows: TicketRow[] = tickets.map((t) => ({
    id: t.id,
    type: t.type,
    status: t.status,
    orderNumber: t.orderNumber,
    name: t.name,
    email: t.email,
    phone: t.phone,
    subject: t.subject,
    message: t.message,
    createdAt: t.createdAt.toISOString(),
  }));

  return (
    <div className="a-page active">
      <div className="a-title">Support &amp; Returns</div>
      <div className="a-sub">Support requests, returns and refunds from customers</div>
      <SupportAdmin initial={rows} />
    </div>
  );
}
