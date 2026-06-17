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
          shipAddress: true,
        },
      },
      addresses: true,
    },
  });
}

export type CustomerWithOrders = NonNullable<Awaited<ReturnType<typeof getCustomerWithOrders>>>;
