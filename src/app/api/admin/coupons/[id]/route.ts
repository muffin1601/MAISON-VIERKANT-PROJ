import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

const patchSchema = z.object({
  isActive: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  description: z.string().trim().max(200).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  usageLimit: z.number().int().positive().nullable().optional(),
});

async function guard() {
  try {
    return await requirePermission("pricing.manage");
  } catch (e) {
    const status = e instanceof AuthError && e.code === "UNAUTHENTICATED" ? 401 : 403;
    return NextResponse.json({ error: { message: "Not authorized" } }, { status });
  }
}

/** PATCH /api/admin/coupons/:id — disable/enable, change expiry or limit. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await guard();
  if (user instanceof NextResponse) return user;
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid JSON" } }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: { message: "Invalid request" } }, { status: 422 });
  const d = parsed.data;

  try {
    const coupon = await prisma.coupon.update({
      where: { id },
      data: {
        ...(d.isActive !== undefined && { isActive: d.isActive }),
        ...(d.isPublic !== undefined && { isPublic: d.isPublic }),
        ...(d.description !== undefined && { description: d.description || null }),
        ...(d.expiresAt !== undefined && { expiresAt: d.expiresAt ? new Date(d.expiresAt) : null }),
        ...(d.usageLimit !== undefined && { usageLimit: d.usageLimit }),
      },
    });
    await recordAudit({ actorId: user.id, action: "coupon.update", entity: "Coupon", entityId: coupon.id, after: { isActive: coupon.isActive } });
    return NextResponse.json({ data: { id: coupon.id } });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2025") {
      return NextResponse.json({ error: { message: "Coupon not found." } }, { status: 404 });
    }
    logger.error({ err }, "coupon update failed");
    return NextResponse.json({ error: { message: "Could not update coupon." } }, { status: 500 });
  }
}
