import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { createCheckoutSession } from "@/services/checkout/checkoutSession";

export const runtime = "nodejs";

const schema = z.object({
  customer: z.object({
    name: z.string().min(1),
    email: z.string().email().optional().or(z.literal("")).default(""),
    phone: z.string().optional().default(""),
    company: z.string().optional().default(""),
    gst: z.string().optional().default(""),
    addr1: z.string().optional().default(""),
    addr2: z.string().optional().default(""),
    city: z.string().optional().default(""),
    state: z.string().optional().default(""),
    pin: z.string().optional().default(""),
    notes: z.string().optional().default(""),
  }),
  items: z
    .array(
      z.object({
        code: z.string().min(1),
        variantCode: z.string().min(1),
        finish: z.string().min(1),
        qty: z.number().int().positive().max(999),
      }),
    )
    .min(1),
  couponCode: z.string().trim().max(40).optional(),
});

/**
 * Create a DRAFT checkout session. No permanent Order is created here — only a
 * 24h-expiry draft with server-computed totals. Returns the public token + the
 * authoritative money figures the review screen renders.
 */
export async function POST(req: Request) {
  const rl = await rateLimit(`checkout-session:${clientIp(req)}`, 30, 10 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: { message: "Too many attempts. Please wait a moment." } },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid JSON" } }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: "Validation failed", issues: parsed.error.flatten() } },
      { status: 422 },
    );
  }

  try {
    const user = await getCurrentUser();
    const session = await createCheckoutSession({
      customer: parsed.data.customer,
      items: parsed.data.items,
      customerUserId: user?.role === "CUSTOMER" ? user.id : null,
      couponCode: parsed.data.couponCode ?? null,
    });
    return NextResponse.json({ data: session }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "EMPTY_CART") {
      return NextResponse.json(
        { error: { message: "None of your cart items match live products." } },
        { status: 422 },
      );
    }
    logger.error({ err }, "create checkout session failed");
    return NextResponse.json(
      { error: { message: "Could not start checkout. Please try again." } },
      { status: 500 },
    );
  }
}
