import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { getUsableSession, finalizeSessionToOrder } from "@/services/checkout/checkoutSession";

export const runtime = "nodejs";

const schema = z.object({ sessionToken: z.string().min(1) });

/**
 * Bank-transfer "Place Order": turn a draft session into a real Order with status
 * PENDING_PAYMENT (awaiting offline payment + admin verification). Idempotent — a
 * double-click or refresh returns the same order, never a duplicate.
 */
export async function POST(req: Request) {
  const rl = await rateLimit(`place-order:${clientIp(req)}`, 20, 10 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json({ error: { message: "Too many attempts." } }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid JSON" } }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: { message: "Validation failed" } }, { status: 422 });
  }

  try {
    const session = await getUsableSession(parsed.data.sessionToken);
    if (!session) {
      return NextResponse.json(
        { error: { message: "Your checkout session expired. Please review your cart again.", code: "SESSION_EXPIRED" } },
        { status: 410 },
      );
    }
    const order = await finalizeSessionToOrder(session, { method: "BANK_TRANSFER", paid: false });
    return NextResponse.json({
      data: {
        orderId: order.orderId,
        orderNumber: order.orderNumber,
        totalInr: order.totalInr,
        advanceInr: order.advanceInr,
      },
    });
  } catch (err) {
    logger.error({ err }, "place bank order failed");
    return NextResponse.json(
      { error: { message: "Could not place your order. Please try again." } },
      { status: 500 },
    );
  }
}
