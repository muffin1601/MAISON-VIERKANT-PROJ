import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { logger } from "@/lib/logger";
import { removeFromWishlist } from "@/services/account/wishlist";

export const runtime = "nodejs";

/** DELETE /api/account/wishlist/:slug — remove one saved product. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: { message: "Sign in required." } }, { status: 401 });
  const { slug } = await params;
  try {
    await removeFromWishlist(user.id, decodeURIComponent(slug));
    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    logger.error({ err }, "wishlist: remove failed");
    return NextResponse.json({ error: { message: "Could not remove item." } }, { status: 500 });
  }
}
