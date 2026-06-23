import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { logger } from "@/lib/logger";
import { removeSavedCard, setDefaultCard } from "@/services/payment/savedCards";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/account/cards/:id — set as default. */
export async function PATCH(req: Request, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: { message: "Sign in required." } }, { status: 401 });
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid JSON" } }, { status: 400 });
  }
  const parsed = z.object({ isDefault: z.literal(true) }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: { message: "Invalid request" } }, { status: 422 });
  try {
    const ok = await setDefaultCard(user.id, id);
    if (!ok) return NextResponse.json({ error: { message: "Card not found." } }, { status: 404 });
    return NextResponse.json({ data: { id } });
  } catch (err) {
    logger.error({ err }, "cards: set default failed");
    return NextResponse.json({ error: { message: "Could not update card." } }, { status: 500 });
  }
}

/** DELETE /api/account/cards/:id — remove from the vault. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: { message: "Sign in required." } }, { status: 401 });
  const { id } = await params;
  try {
    const ok = await removeSavedCard(user.id, id);
    if (!ok) return NextResponse.json({ error: { message: "Card not found." } }, { status: 404 });
    return NextResponse.json({ data: { id } });
  } catch (err) {
    logger.error({ err }, "cards: delete failed");
    return NextResponse.json({ error: { message: "Could not remove card." } }, { status: 500 });
  }
}
