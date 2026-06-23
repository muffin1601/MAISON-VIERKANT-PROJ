import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { listAvailableCoupons, listUsedCoupons } from "@/services/coupons/coupons";

export const runtime = "nodejs";

/** GET /api/account/coupons — available coupons + the user's redemption history. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: { message: "Sign in required." } }, { status: 401 });

  const customer = await prisma.customer.findUnique({ where: { userId: user.id }, select: { id: true } });
  const [available, used] = await Promise.all([
    listAvailableCoupons(),
    customer ? listUsedCoupons(customer.id) : Promise.resolve([]),
  ]);
  return NextResponse.json({ data: { available, used } });
}
