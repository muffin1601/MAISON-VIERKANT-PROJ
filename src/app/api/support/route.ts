import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { createTicket } from "@/services/support/support";

export const runtime = "nodejs";

const schema = z.object({
  type: z.enum(["SUPPORT", "RETURN", "REFUND", "ORDER"]),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  phone: z.string().trim().max(20).optional().default(""),
  subject: z.string().trim().min(3).max(160),
  message: z.string().trim().min(5).max(4000),
  orderNumber: z.string().trim().max(40).optional().default(""),
});

/** POST /api/support — create a support / return / refund ticket (public, rate-limited). */
export async function POST(req: Request) {
  const rl = await rateLimit(`support:${clientIp(req)}`, 10, 10 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: { message: "Too many requests. Please wait." } }, { status: 429 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid JSON" } }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: "Please complete all required fields.", issues: parsed.error.flatten().fieldErrors } },
      { status: 422 },
    );
  }
  const d = parsed.data;

  // Link to the customer record when signed in.
  const user = await getCurrentUser();
  const customerId =
    user?.role === "CUSTOMER"
      ? (await prisma.customer.findUnique({ where: { userId: user.id }, select: { id: true } }))?.id ?? null
      : null;

  try {
    const ticket = await createTicket({
      type: d.type,
      name: d.name,
      email: d.email,
      phone: d.phone,
      subject: d.subject,
      message: d.message,
      orderNumber: d.orderNumber,
      customerId,
    });
    return NextResponse.json({ data: { id: ticket.id } }, { status: 201 });
  } catch (err) {
    logger.error({ err }, "support ticket create failed");
    return NextResponse.json({ error: { message: "Could not submit your request. Please try again." } }, { status: 500 });
  }
}
