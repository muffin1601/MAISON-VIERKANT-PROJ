import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { logger } from "@/lib/logger";
import { listSavedCards } from "@/services/payment/savedCards";

export const runtime = "nodejs";

/** GET /api/account/cards — the signed-in customer's saved (tokenised) cards. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: { message: "Sign in required." } }, { status: 401 });
  try {
    return NextResponse.json({ data: await listSavedCards(user.id) });
  } catch (err) {
    logger.error({ err }, "cards: list failed");
    return NextResponse.json({ error: { message: "Could not load cards." } }, { status: 500 });
  }
}
