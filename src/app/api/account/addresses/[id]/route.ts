import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { addressPatchSchema } from "@/validations/address";
import { updateAddress, deleteAddress } from "@/services/account/addresses";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/account/addresses/:id — edit fields or set as default (isDefault:true). */
export async function PATCH(req: Request, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: { message: "Sign in required." } }, { status: 401 });

  const rl = await rateLimit(`addr-write:${clientIp(req)}`, 30, 10 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: { message: "Too many attempts." } }, { status: 429 });

  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid JSON" } }, { status: 400 });
  }
  const parsed = addressPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: "Please correct the highlighted fields.", issues: parsed.error.flatten().fieldErrors } },
      { status: 422 },
    );
  }
  try {
    const data = await updateAddress(user.id, id, parsed.data);
    if (!data) return NextResponse.json({ error: { message: "Address not found." } }, { status: 404 });
    return NextResponse.json({ data });
  } catch (err) {
    logger.error({ err }, "addresses: update failed");
    return NextResponse.json({ error: { message: "Could not update address." } }, { status: 500 });
  }
}

/** DELETE /api/account/addresses/:id — remove an address (promotes a new default). */
export async function DELETE(req: Request, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: { message: "Sign in required." } }, { status: 401 });

  const { id } = await params;
  try {
    const ok = await deleteAddress(user.id, id);
    if (!ok) return NextResponse.json({ error: { message: "Address not found." } }, { status: 404 });
    return NextResponse.json({ data: { id } });
  } catch (err) {
    logger.error({ err }, "addresses: delete failed");
    return NextResponse.json({ error: { message: "Could not delete address." } }, { status: 500 });
  }
}
