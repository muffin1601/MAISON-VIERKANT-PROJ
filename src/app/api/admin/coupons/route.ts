import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

const createSchema = z.object({
  code: z.string().trim().min(2).max(40),
  description: z.string().trim().max(200).optional().default(""),
  type: z.enum(["PERCENT", "FLAT"]),
  value: z.number().positive(),
  minSubtotalInr: z.number().min(0).optional().default(0),
  maxDiscountInr: z.number().positive().optional(),
  usageLimit: z.number().int().positive().optional(),
  perUserLimit: z.number().int().min(0).optional().default(1),
  startsAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  isPublic: z.boolean().optional().default(true),
});

async function guard() {
  try {
    return await requirePermission("pricing.manage");
  } catch (e) {
    const status = e instanceof AuthError && e.code === "UNAUTHENTICATED" ? 401 : 403;
    return NextResponse.json({ error: { message: "Not authorized" } }, { status });
  }
}

/** GET /api/admin/coupons — list all coupons. */
export async function GET() {
  const user = await guard();
  if (user instanceof NextResponse) return user;
  const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({
    data: coupons.map((c) => ({
      ...c,
      value: Number(c.value),
      minSubtotalInr: Number(c.minSubtotalInr),
      maxDiscountInr: c.maxDiscountInr != null ? Number(c.maxDiscountInr) : null,
    })),
  });
}

/** POST /api/admin/coupons — create a coupon. */
export async function POST(req: Request) {
  const user = await guard();
  if (user instanceof NextResponse) return user;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid JSON" } }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: "Please correct the fields.", issues: parsed.error.flatten().fieldErrors } },
      { status: 422 },
    );
  }
  const d = parsed.data;
  if (d.type === "PERCENT" && d.value > 100) {
    return NextResponse.json({ error: { message: "Percent value can't exceed 100." } }, { status: 422 });
  }
  try {
    const coupon = await prisma.coupon.create({
      data: {
        code: d.code.toUpperCase(),
        description: d.description || null,
        type: d.type,
        value: d.value,
        minSubtotalInr: d.minSubtotalInr,
        maxDiscountInr: d.maxDiscountInr ?? null,
        usageLimit: d.usageLimit ?? null,
        perUserLimit: d.perUserLimit,
        startsAt: d.startsAt ? new Date(d.startsAt) : null,
        expiresAt: d.expiresAt ? new Date(d.expiresAt) : null,
        isPublic: d.isPublic,
      },
    });
    await recordAudit({ actorId: user.id, action: "coupon.create", entity: "Coupon", entityId: coupon.id, after: { code: coupon.code } });
    return NextResponse.json({ data: { id: coupon.id, code: coupon.code } }, { status: 201 });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      return NextResponse.json({ error: { message: "A coupon with that code already exists." } }, { status: 409 });
    }
    logger.error({ err }, "coupon create failed");
    return NextResponse.json({ error: { message: "Could not create coupon." } }, { status: 500 });
  }
}
