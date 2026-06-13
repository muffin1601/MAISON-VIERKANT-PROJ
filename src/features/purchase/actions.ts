"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { z } from "zod";

const poSchema = z.object({
  lines: z
    .array(
      z.object({
        variantCode: z.string().min(1),
        qty: z.number().int().positive(),
        unitEur: z.number().nonnegative(),
      }),
    )
    .min(1),
});

export type POInput = z.infer<typeof poSchema>;

export async function savePO(input: POInput): Promise<{ id: string; number: string }> {
  const user = await requirePermission("purchase.write");
  const d = poSchema.parse(input);
  const totalEur = d.lines.reduce((s, l) => s + l.unitEur * l.qty, 0);
  const number = "MVI-PO-" + Date.now().toString().slice(-6);

  const po = await prisma.purchaseOrder.create({
    data: {
      number,
      supplier: "Atelier Vierkant",
      currency: "EUR",
      status: "DRAFT",
      totalEur,
      items: { create: d.lines.map((l) => ({ variantCode: l.variantCode, qty: l.qty, unitEur: l.unitEur })) },
    },
  });
  await recordAudit({ actorId: user.id, action: "purchaseOrder.create", entity: "PurchaseOrder", entityId: po.id, after: { number, totalEur } });
  revalidatePath("/admin/purchase-orders");
  return { id: po.id, number };
}
