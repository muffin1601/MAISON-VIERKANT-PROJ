import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { changePasswordSchema } from "@/validations/profile";
import { changePassword } from "@/services/account/profile";

export const runtime = "nodejs";

/** POST /api/account/change-password — verify current password, set a new strong one. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: { message: "Sign in required." } }, { status: 401 });

  const rl = await rateLimit(`pwd-change:${clientIp(req)}`, 10, 10 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: { message: "Too many attempts. Please wait." } }, { status: 429 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid JSON" } }, { status: 400 });
  }
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: "Please correct the highlighted fields.", issues: parsed.error.flatten().fieldErrors } },
      { status: 422 },
    );
  }
  try {
    const result = await changePassword(user.id, parsed.data.currentPassword, parsed.data.newPassword);
    if (result === "NO_PASSWORD") {
      return NextResponse.json(
        { error: { message: "Your account has no password set. Use “Forgot password” to create one." } },
        { status: 409 },
      );
    }
    if (result === "WRONG_PASSWORD") {
      return NextResponse.json(
        { error: { message: "Your current password is incorrect.", issues: { currentPassword: ["Incorrect password"] } } },
        { status: 422 },
      );
    }
    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    logger.error({ err }, "change-password failed");
    return NextResponse.json({ error: { message: "Could not change password." } }, { status: 500 });
  }
}
