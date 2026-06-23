import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { logger } from "@/lib/logger";
import { listWishlist, addToWishlist, syncWishlist } from "@/services/account/wishlist";

export const runtime = "nodejs";

const slugSchema = z.object({ slug: z.string().trim().min(1).max(160) });
const syncSchema = z.object({ slugs: z.array(z.string().trim().min(1).max(160)).max(500) });

/** GET /api/account/wishlist — saved product slugs for the signed-in user. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: { message: "Sign in required." } }, { status: 401 });
  try {
    return NextResponse.json({ data: { slugs: await listWishlist(user.id) } });
  } catch (err) {
    logger.error({ err }, "wishlist: list failed");
    return NextResponse.json({ error: { message: "Could not load wishlist." } }, { status: 500 });
  }
}

/** POST /api/account/wishlist — add a single slug. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: { message: "Sign in required." } }, { status: 401 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid JSON" } }, { status: 400 });
  }
  const parsed = slugSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: { message: "Invalid slug" } }, { status: 422 });
  try {
    await addToWishlist(user.id, parsed.data.slug);
    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    logger.error({ err }, "wishlist: add failed");
    return NextResponse.json({ error: { message: "Could not save item." } }, { status: 500 });
  }
}

/** PUT /api/account/wishlist — merge local slugs into the server set; returns the union. */
export async function PUT(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: { message: "Sign in required." } }, { status: 401 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid JSON" } }, { status: 400 });
  }
  const parsed = syncSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: { message: "Invalid payload" } }, { status: 422 });
  try {
    const slugs = await syncWishlist(user.id, parsed.data.slugs);
    return NextResponse.json({ data: { slugs } });
  } catch (err) {
    logger.error({ err }, "wishlist: sync failed");
    return NextResponse.json({ error: { message: "Could not sync wishlist." } }, { status: 500 });
  }
}
