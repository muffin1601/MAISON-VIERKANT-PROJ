import { prisma } from "@/lib/prisma";

/** The logged-in customer's CRM record + orders (most recent first). */
export async function getCustomerWithOrders(userId: string) {
  return prisma.customer.findUnique({
    where: { userId },
    include: {
      orders: {
        orderBy: { createdAt: "desc" },
        include: {
          items: { include: { product: true, variant: true } },
          payments: true,
          paymentSubmissions: { orderBy: { createdAt: "desc" } },
          shipAddress: true,
        },
      },
      addresses: true,
    },
  });
}

export type CustomerWithOrders = NonNullable<Awaited<ReturnType<typeof getCustomerWithOrders>>>;

/** A single order owned by this user, with full detail for the order page. Null if not owned. */
export async function getOrderForUser(userId: string, number: string) {
  const order = await prisma.order.findUnique({
    where: { number },
    include: {
      items: { include: { product: true, variant: true } },
      payments: { orderBy: { createdAt: "desc" } },
      paymentSubmissions: { orderBy: { createdAt: "desc" } },
      shipAddress: true,
      statusHistory: { orderBy: { createdAt: "asc" } },
      customer: { select: { userId: true, email: true, name: true } },
    },
  });
  if (!order || order.customer?.userId !== userId) return null;
  return order;
}

export type OrderDetail = NonNullable<Awaited<ReturnType<typeof getOrderForUser>>>;
