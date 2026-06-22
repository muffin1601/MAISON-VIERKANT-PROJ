import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/rbac";
import { ensureInvoice } from "@/services/payment/paymentOrders";
import { InvoicePdf, type InvoicePdfData } from "@/services/orders/InvoicePdf";
import { PaymentStatus, PaymentProvider } from "@/lib/paymentStatus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Download the tax invoice for a PAID order as a branded A4 PDF. Access: the
 * owning customer or any admin with orders.read. Only available once the advance
 * has been captured.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      shipAddress: true,
      items: { include: { product: { select: { name: true, code: true } }, variant: true } },
      payments: true,
      invoice: true,
    },
  });
  if (!order) return new Response("Order not found", { status: 404 });

  // Authorization: owner or staff.
  const user = await getCurrentUser();
  const isOwner = !!user && user.role === "CUSTOMER" && order.customer?.userId === user.id;
  const isStaff = !!user && hasPermission(user.permissions, "orders.read");
  if (!isOwner && !isStaff) {
    return new Response("Not authorized", { status: user ? 403 : 401 });
  }

  const captured = order.payments.find(
    (p) => p.provider === PaymentProvider.RAZORPAY && p.status === PaymentStatus.CAPTURED,
  );
  const advancePaidStates = ["PAYMENT_VERIFIED", "IN_PRODUCTION", "READY_TO_DISPATCH", "DISPATCHED", "DELIVERED"];
  if (!captured && !advancePaidStates.includes(order.status)) {
    return new Response("Invoice is available after payment.", { status: 409 });
  }

  const invoiceNumber = order.invoice?.number ?? (await ensureInvoice(order.id)) ?? `MVI-INV-${order.number}`;

  const address = [
    order.shipAddress?.line1,
    order.shipAddress?.line2,
    order.shipAddress ? `${order.shipAddress.city}, ${order.shipAddress.state} ${order.shipAddress.pincode}` : "",
  ]
    .filter(Boolean)
    .join(", ");

  const amountPaid = captured ? Number(captured.amountInr) : Number(order.advanceInr);
  const data: InvoicePdfData = {
    invoiceNumber,
    orderNumber: order.number,
    date: order.createdAt.toISOString().slice(0, 10),
    customer: order.customer?.name ?? "—",
    company: order.customer?.company ?? "",
    email: order.customer?.email ?? "",
    phone: order.customer?.phone ?? "",
    address,
    gstin: "",
    items: order.items.map((it) => ({
      name: it.product?.name ?? "—",
      code: it.variant?.code ?? it.product?.code ?? "",
      finish: it.finish,
      qty: it.qty,
      unit: Number(it.unitPriceInr),
    })),
    subtotal: Number(order.subtotalInr),
    gst: Number(order.gstInr),
    total: Number(order.totalInr),
    amountPaid,
    balanceDue: Number(order.totalInr) - amountPaid,
    paymentId: captured?.gatewayPaymentId ?? "",
    paidAt: captured?.paidAt ? captured.paidAt.toISOString().slice(0, 10) : "",
  };

  const buffer = await renderToBuffer(<InvoicePdf d={data} />);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoiceNumber}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
