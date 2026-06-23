import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { listTicketsForCustomer } from "@/services/support/support";

export const runtime = "nodejs";

/** GET /api/account/support — the signed-in customer's support tickets. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: { message: "Sign in required." } }, { status: 401 });
  const customer = await prisma.customer.findUnique({ where: { userId: user.id }, select: { id: true } });
  const data = customer ? await listTicketsForCustomer(customer.id) : [];
  return NextResponse.json({ data });
}
