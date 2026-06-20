"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { withPermission } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import {
  sendPaymentApprovedEmail,
  sendPaymentRejectedEmail,
  sendOrderStatusEmail,
} from "@/lib/email/notify";
import { savePaymentSettings, type PaymentSettings } from "@/services/settings/paymentSettings";
import { logger } from "@/lib/logger";

type Result =
  | { ok: true }
  | { ok: false; notFound?: true; message?: string };

/** Approve a payment submission → order becomes PAYMENT_VERIFIED. Requires payments.write. */
export const approvePayment = withPermission(
  "payments.write",
  async (user, input: { id: string }): Promise<Result> => {
    const sub = await prisma.paymentSubmission.findUnique({
      where: { id: input.id },
      include: { order: { include: { customer: true } } },
    });
    if (!sub) return { ok: false, notFound: true };
    if (sub.status !== "SUBMITTED") return { ok: false, message: "This payment is not awaiting review." };

    await prisma.$transaction([
      prisma.paymentSubmission.update({
        where: { id: sub.id },
        data: { status: "VERIFIED", reviewedById: user.id, reviewedAt: new Date(), rejectionReason: null },
      }),
      // Only advance the order if it's still in a payment-pending state — never
      // regress an order an admin already moved into production.
      prisma.order.updateMany({
        where: { id: sub.orderId, status: { in: ["PENDING_PAYMENT", "PAYMENT_SUBMITTED", "PAYMENT_REJECTED"] } },
        data: { status: "PAYMENT_VERIFIED" },
      }),
    ]);

    await recordAudit({
      actorId: user.id,
      action: "payment.approve",
      entity: "PaymentSubmission",
      entityId: sub.id,
      before: { status: "SUBMITTED" },
      after: { status: "VERIFIED", orderNumber: sub.order.number, amount: Number(sub.amountInr) },
    });

    if (sub.order.customer.email) {
      void sendPaymentApprovedEmail({
        to: sub.order.customer.email,
        name: sub.order.customer.name,
        number: sub.order.number,
        amountInr: Number(sub.amountInr),
      }).catch((err) => logger.error({ err }, "approve email failed"));
    }

    revalidatePath("/admin/payments");
    revalidatePath("/admin/dashboard");
    revalidatePath("/admin/orders");
    return { ok: true };
  },
);

/** Reject a payment submission → order returns to PAYMENT_REJECTED. Requires payments.write. */
export const rejectPayment = withPermission(
  "payments.write",
  async (user, input: { id: string; reason: string }): Promise<Result> => {
    const reason = input.reason?.trim();
    if (!reason || reason.length < 3) return { ok: false, message: "Please provide a rejection reason." };

    const sub = await prisma.paymentSubmission.findUnique({
      where: { id: input.id },
      include: { order: { include: { customer: true } } },
    });
    if (!sub) return { ok: false, notFound: true };
    if (sub.status !== "SUBMITTED") return { ok: false, message: "This payment is not awaiting review." };

    await prisma.$transaction([
      prisma.paymentSubmission.update({
        where: { id: sub.id },
        data: { status: "REJECTED", reviewedById: user.id, reviewedAt: new Date(), rejectionReason: reason },
      }),
      // Only regress to PAYMENT_REJECTED from a payment-pending state.
      prisma.order.updateMany({
        where: { id: sub.orderId, status: { in: ["PENDING_PAYMENT", "PAYMENT_SUBMITTED"] } },
        data: { status: "PAYMENT_REJECTED" },
      }),
    ]);

    await recordAudit({
      actorId: user.id,
      action: "payment.reject",
      entity: "PaymentSubmission",
      entityId: sub.id,
      before: { status: "SUBMITTED" },
      after: { status: "REJECTED", reason, orderNumber: sub.order.number },
    });

    if (sub.order.customer.email) {
      void sendPaymentRejectedEmail({
        to: sub.order.customer.email,
        name: sub.order.customer.name,
        number: sub.order.number,
        reason,
      }).catch((err) => logger.error({ err }, "reject email failed"));
    }

    revalidatePath("/admin/payments");
    revalidatePath("/admin/dashboard");
    return { ok: true };
  },
);

/**
 * Request clarification: emails the customer a note without changing the payment's
 * status (it stays SUBMITTED in the queue). Requires payments.write.
 */
export const requestClarification = withPermission(
  "payments.write",
  async (user, input: { id: string; message: string }): Promise<Result> => {
    const message = input.message?.trim();
    if (!message || message.length < 3) return { ok: false, message: "Please enter a message." };

    const sub = await prisma.paymentSubmission.findUnique({
      where: { id: input.id },
      include: { order: { include: { customer: true } } },
    });
    if (!sub) return { ok: false, notFound: true };
    if (sub.status !== "SUBMITTED") return { ok: false, message: "This payment is not awaiting review." };

    await recordAudit({
      actorId: user.id,
      action: "payment.clarify",
      entity: "PaymentSubmission",
      entityId: sub.id,
      after: { orderNumber: sub.order.number, message },
    });

    if (sub.order.customer.email) {
      // Reuse the status email channel with a clarification note.
      void sendOrderStatusEmail({
        to: sub.order.customer.email,
        name: sub.order.customer.name,
        number: sub.order.number,
        status: `Payment query: ${message}`,
      }).catch((err) => logger.error({ err }, "clarify email failed"));
    }
    return { ok: true };
  },
);

/** Save the bank/UPI payment settings shown to customers. Requires settings.manage. */
export const updatePaymentSettings = withPermission(
  "settings.manage",
  async (user, input: PaymentSettings): Promise<Result> => {
    await savePaymentSettings(input);
    await recordAudit({
      actorId: user.id,
      action: "settings.payment",
      entity: "Setting",
      entityId: "payment.bank",
      after: { bankName: input.bankName, upiId: input.upiId },
    });
    revalidatePath("/admin/payment-settings");
    return { ok: true };
  },
);
