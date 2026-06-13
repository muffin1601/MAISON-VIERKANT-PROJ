import "server-only";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

/**
 * Append-only audit trail. Call after every mutating admin action. Never throws — auditing
 * must not break the underlying operation.
 */
export async function recordAudit(params: {
  actorId?: string | null;
  action: string; // e.g. "product.create", "product.delete", "pricing.update"
  entity: string; // e.g. "Product"
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  try {
    let ip: string | null = null;
    try {
      const h = await headers();
      ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
    } catch {
      /* outside request scope */
    }
    await prisma.auditLog.create({
      data: {
        actorId: params.actorId ?? null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId ?? null,
        before: (params.before ?? undefined) as never,
        after: (params.after ?? undefined) as never,
        ip,
      },
    });
  } catch {
    /* swallow — auditing is best-effort */
  }
}
