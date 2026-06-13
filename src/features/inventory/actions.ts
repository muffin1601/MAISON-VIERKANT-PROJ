"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";

/** Adjust stock for a product (verbatim behaviour of prototype adjStock, now persisted). */
export async function adjustStock(productId: string, delta: number): Promise<number> {
  const user = await requirePermission("inventory.write");

  const inv = await prisma.inventory.findUnique({ where: { productId } });
  if (!inv) throw new Error("Inventory not found");

  const next = Math.max(0, inv.quantity + delta);
  await prisma.$transaction([
    prisma.inventory.update({ where: { id: inv.id }, data: { quantity: next } }),
    prisma.inventoryTransaction.create({
      data: {
        inventoryId: inv.id,
        delta,
        reason: "ADJUSTMENT",
        balanceAfter: next,
        actorId: user.id,
      },
    }),
  ]);
  await recordAudit({
    actorId: user.id,
    action: "inventory.adjust",
    entity: "Inventory",
    entityId: inv.id,
    before: { quantity: inv.quantity },
    after: { quantity: next, delta },
  });
  return next;
}
