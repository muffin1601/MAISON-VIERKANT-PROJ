import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { profilePatchSchema } from "@/validations/profile";
import { getProfile, updateProfile } from "@/services/account/profile";

export const runtime = "nodejs";

/** GET /api/account/profile — the signed-in user's profile. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: { message: "Sign in required." } }, { status: 401 });
  const data = await getProfile(user.id);
  if (!data) return NextResponse.json({ error: { message: "Profile not found." } }, { status: 404 });
  return NextResponse.json({ data });
}

/** PATCH /api/account/profile — update name and/or phone. */
export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: { message: "Sign in required." } }, { status: 401 });

  const rl = await rateLimit(`profile:${clientIp(req)}`, 30, 10 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: { message: "Too many attempts." } }, { status: 429 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid JSON" } }, { status: 400 });
  }
  const parsed = profilePatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: "Please correct the highlighted fields.", issues: parsed.error.flatten().fieldErrors } },
      { status: 422 },
    );
  }
  try {
    const data = await updateProfile(user.id, parsed.data);
    return NextResponse.json({ data });
  } catch (err) {
    logger.error({ err }, "profile: update failed");
    return NextResponse.json({ error: { message: "Could not update profile." } }, { status: 500 });
  }
}
