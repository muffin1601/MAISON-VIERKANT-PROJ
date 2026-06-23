"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { withPermission } from "@/lib/auth/session";
import { sendOrderStatusEmail } from "@/lib/email/notify";
import { recordAudit } from "@/lib/audit";
import { ADMIN_ASSIGNABLE_STATUSES } from "@/lib/orderStatus";
import { logger } from "@/lib/logger";

// Admin-assignable order statuses (offline-payment lifecycle). Payment-driven
// transitions (PAYMENT_SUBMITTED / PAYMENT_REJECTED) are set by the payment flow.
export const ORDER_STATUSES = ADMIN_ASSIGNABLE_STATUSES;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/**
 * Admin order-status update. Requires `orders.write`. Persists the new status (and
 * optional tracking number) and emails the customer — the only notification channel
 * is email (no SMS).
 */
export const updateOrderStatus = withPermission(
  "orders.write",
  async (
    user,
    input: {
      number: string;
      status: OrderStatus;
      trackingNumber?: string;
      courier?: string;
      trackingUrl?: string;
    },
  ) => {
    if (!ORDER_STATUSES.includes(input.status)) {
      throw new Error("Invalid status");
    }
    let order;
    const prev = await prisma.order.findUnique({
      where: { number: input.number },
      select: { status: true, id: true, trackingNumber: true },
    });
    try {
      order = await prisma.order.update({
        where: { number: input.number },
        data: {
          status: input.status,
          ...(input.trackingNumber !== undefined
            ? { trackingNumber: input.trackingNumber || null }
            : {}),
          ...(input.courier !== undefined ? { courier: input.courier || null } : {}),
          ...(input.trackingUrl !== undefined ? { trackingUrl: input.trackingUrl || null } : {}),
        },
        include: { customer: true },
      });
      // Append a timeline event only when the status actually changes.
      if (prev && prev.status !== input.status) {
        await prisma.orderStatusEvent.create({
          data: {
            orderId: order.id,
            status: input.status,
            actorId: user.id,
            note: input.trackingNumber ? `Tracking: ${input.trackingNumber}` : null,
          },
        });
      }
    } catch (err) {
      // Unknown order number → return a clean result instead of a raw 500.
      if (err && typeof err === "object" && "code" in err && err.code === "P2025") {
        return { ok: false as const, notFound: true as const };
      }
      throw err;
    }

    const statusChanged = prev?.status !== order.status;
    const trackingChanged = (prev?.trackingNumber ?? null) !== (order.trackingNumber ?? null);
    if (order.customer.email && (statusChanged || trackingChanged)) {
      void sendOrderStatusEmail({
        to: order.customer.email,
        name: order.customer.name,
        number: order.number,
        status: order.status,
        trackingNumber: order.trackingNumber,
      }).catch((err) => logger.error({ err }, "status email failed"));
    }

    await recordAudit({
      actorId: user.id,
      action: "order.status",
      entity: "Order",
      entityId: order.number,
      before: { status: prev?.status },
      after: { status: order.status, trackingNumber: order.trackingNumber },
    });

    revalidatePath("/admin/orders");
    revalidatePath("/admin/dashboard");
    return { ok: true, status: order.status };
  },
);
