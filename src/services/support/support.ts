import "server-only";
import { prisma } from "@/lib/prisma";
import { env, appUrl } from "@/lib/env";
import { sendEmail } from "@/lib/email/client";

export type TicketType = "SUPPORT" | "RETURN" | "REFUND" | "ORDER";

const TYPE_LABEL: Record<TicketType, string> = {
  SUPPORT: "Support request",
  RETURN: "Return request",
  REFUND: "Refund request",
  ORDER: "Order help",
};

export interface CreateTicketInput {
  type: TicketType;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  orderNumber?: string;
  customerId?: string | null;
}

export async function createTicket(input: CreateTicketInput) {
  const ticket = await prisma.supportTicket.create({
    data: {
      type: input.type,
      name: input.name,
      email: input.email,
      phone: input.phone || null,
      subject: input.subject,
      message: input.message,
      orderNumber: input.orderNumber || null,
      customerId: input.customerId ?? null,
    },
  });

  // Notify the team (best-effort) + acknowledge the customer.
  const label = TYPE_LABEL[input.type];
  if (env.ADMIN_NOTIFY_EMAIL) {
    void sendEmail({
      to: env.ADMIN_NOTIFY_EMAIL,
      subject: `[${label}] ${input.subject}`,
      replyTo: input.email,
      html: `<h2>${label}</h2>
        <p><strong>From:</strong> ${escape(input.name)} &lt;${escape(input.email)}&gt;${input.phone ? ` · ${escape(input.phone)}` : ""}</p>
        ${input.orderNumber ? `<p><strong>Order:</strong> ${escape(input.orderNumber)}</p>` : ""}
        <p><strong>Subject:</strong> ${escape(input.subject)}</p>
        <p>${escape(input.message).replace(/\n/g, "<br>")}</p>`,
    });
  }
  void sendEmail({
    to: input.email,
    subject: `We've received your ${label.toLowerCase()}`,
    html: `<p>Hi ${escape(input.name)},</p>
      <p>Thanks for reaching out. We've logged your ${label.toLowerCase()}${input.orderNumber ? ` for order <strong>${escape(input.orderNumber)}</strong>` : ""} and our team will reply within 24 hours.</p>
      <p style="color:#666">Reference: ${ticket.id}</p>
      <p><a href="${appUrl}/account/support">View your requests →</a></p>`,
  });

  return ticket;
}

export async function listTicketsForCustomer(customerId: string) {
  const rows = await prisma.supportTicket.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return rows.map((t) => ({
    id: t.id,
    type: t.type,
    status: t.status,
    subject: t.subject,
    orderNumber: t.orderNumber,
    createdAt: t.createdAt.toISOString(),
  }));
}

/** Minimal HTML escape for email interpolation. */
function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
