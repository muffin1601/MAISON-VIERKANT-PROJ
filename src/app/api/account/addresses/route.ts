import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { addressInputSchema } from "@/validations/address";
import { listAddresses, createAddress } from "@/services/account/addresses";

export const runtime = "nodejs";

/** GET /api/account/addresses — the signed-in customer's saved addresses. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: { message: "Sign in required." } }, { status: 401 });
  try {
    const data = await listAddresses(user.id);
    return NextResponse.json({ data });
  } catch (err) {
    logger.error({ err }, "addresses: list failed");
    return NextResponse.json({ error: { message: "Could not load addresses." } }, { status: 500 });
  }
}

/** POST /api/account/addresses — create a new address (first one becomes default). */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: { message: "Sign in required." } }, { status: 401 });

  const rl = await rateLimit(`addr-write:${clientIp(req)}`, 30, 10 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: { message: "Too many attempts." } }, { status: 429 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid JSON" } }, { status: 400 });
  }
  const parsed = addressInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: "Please correct the highlighted fields.", issues: parsed.error.flatten().fieldErrors } },
      { status: 422 },
    );
  }
  try {
    const data = await createAddress(user.id, parsed.data);
    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    logger.error({ err }, "addresses: create failed");
    return NextResponse.json({ error: { message: "Could not save address." } }, { status: 500 });
  }
}
