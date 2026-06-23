import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { validateCoupon } from "@/services/coupons/coupons";

export const runtime = "nodejs";

const schema = z.object({
  code: z.string().trim().min(1).max(40),
  baseInr: z.number().positive().max(100_000_000),
});

/** POST /api/coupons/validate — preview a coupon's discount for a given order total. */
export async function POST(req: Request) {
  const rl = await rateLimit(`coupon-validate:${clientIp(req)}`, 30, 10 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: { message: "Too many attempts." } }, { status: 429 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid JSON" } }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: { message: "Invalid request" } }, { status: 422 });

  const user = await getCurrentUser();
  const customerId =
    user?.role === "CUSTOMER"
      ? (await prisma.customer.findUnique({ where: { userId: user.id }, select: { id: true } }))?.id ?? null
      : null;

  const res = await validateCoupon(parsed.data.code, parsed.data.baseInr, customerId);
  if (!res.ok) return NextResponse.json({ error: { message: res.reason } }, { status: 422 });
  return NextResponse.json({ data: { code: res.code, discountInr: res.discountInr, label: res.label } });
}
