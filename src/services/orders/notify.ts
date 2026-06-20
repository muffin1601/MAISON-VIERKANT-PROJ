import { prisma } from "@/lib/prisma";
import {
  sendOrderConfirmationEmail,
  notifyAdminNewOrder,
  sendOrderCreatedOfflineEmail,
} from "@/lib/email/notify";
import type { OrderEmailLine } from "@/lib/email/templates";
import { getPaymentSettings } from "@/services/settings/paymentSettings";
import { logger } from "@/lib/logger";

/**
 * Offline order placed (status PENDING_PAYMENT): email the customer their payment
 * instructions (bank/UPI details + advance due) and notify the admin of the new order.
 * Never throws.
 */
export async function sendOfflineOrderCreated(orderId: string): Promise<void> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true, items: { include: { product: true, variant: true } } },
    });
    if (!order) return;

    const lines: OrderEmailLine[] = order.items.map((it) => ({
      name: it.product.name,
      code: it.variant?.code ?? it.product.code,
      finish: it.finish,
      qty: it.qty,
      lineInr: Number(it.unitPriceInr) * it.qty,
    }));

    if (order.customer.email) {
      const s = await getPaymentSettings();
      await sendOrderCreatedOfflineEmail({
        to: order.customer.email,
        name: order.customer.name,
        number: order.number,
        items: lines,
        totalInr: Number(order.totalInr),
        advanceInr: Number(order.advanceInr),
        bank: s,
      });
    }

    await notifyAdminNewOrder({
      number: order.number,
      name: order.customer.name,
      totalInr: Number(order.totalInr),
      method: "Offline (awaiting payment)",
    });
  } catch (err) {
    logger.error({ err, orderId }, "sendOfflineOrderCreated failed");
  }
}

/**
 * Send the customer order-confirmation email + admin new-order notification for a
 * confirmed order. Safe to call from any confirmation path (COD, mock, Razorpay
 * verify, webhook); never throws. Caller is responsible for only invoking it on a
 * genuine PENDING→CONFIRMED transition so the customer is emailed once.
 */
export async function sendOrderConfirmation(
  orderId: string,
  method: "razorpay" | "cod" | "mock",
): Promise<void> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true, items: { include: { product: true, variant: true } } },
    });
    if (!order) return;

    const lines: OrderEmailLine[] = order.items.map((it) => ({
      name: it.product.name,
      code: it.variant?.code ?? it.product.code,
      finish: it.finish,
      qty: it.qty,
      lineInr: Number(it.unitPriceInr) * it.qty,
    }));

    if (order.customer.email) {
      await sendOrderConfirmationEmail({
        to: order.customer.email,
        name: order.customer.name,
        number: order.number,
        items: lines,
        totalInr: Number(order.totalInr),
        advanceInr: Number(order.advanceInr),
        method,
      });
    }

    await notifyAdminNewOrder({
      number: order.number,
      name: order.customer.name,
      totalInr: Number(order.totalInr),
      method,
    });
  } catch (err) {
    logger.error({ err, orderId }, "sendOrderConfirmation failed");
  }
}
