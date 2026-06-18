"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { withPermission } from "@/lib/auth/session";
import { sendOrderStatusEmail } from "@/lib/email/notify";
import { logger } from "@/lib/logger";

export const ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/**
 * Admin order-status update. Requires `orders.write`. Persists the new status (and
 * optional tracking number) and emails the customer — the only notification channel
 * is email (no SMS).
 */
export const updateOrderStatus = withPermission(
  "orders.write",
  async (_user, input: { number: string; status: OrderStatus; trackingNumber?: string }) => {
    if (!ORDER_STATUSES.includes(input.status)) {
      throw new Error("Invalid status");
    }
    let order;
    try {
      order = await prisma.order.update({
        where: { number: input.number },
        data: {
          status: input.status,
          ...(input.trackingNumber !== undefined
            ? { trackingNumber: input.trackingNumber || null }
            : {}),
        },
        include: { customer: true },
      });
    } catch (err) {
      // Unknown order number → return a clean result instead of a raw 500.
      if (err && typeof err === "object" && "code" in err && err.code === "P2025") {
        return { ok: false as const, notFound: true as const };
      }
      throw err;
    }

    if (order.customer.email) {
      void sendOrderStatusEmail({
        to: order.customer.email,
        name: order.customer.name,
        number: order.number,
        status: order.status,
        trackingNumber: order.trackingNumber,
      }).catch((err) => logger.error({ err }, "status email failed"));
    }

    revalidatePath("/admin/orders");
    return { ok: true, status: order.status };
  },
);
