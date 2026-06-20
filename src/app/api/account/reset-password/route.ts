import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resetPasswordSchema } from "@/validations/auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { hashToken } from "@/lib/auth/tokens";
import { hashPassword } from "@/lib/auth/password";
import { logger } from "@/lib/logger";

/**
 * Complete a password reset. Validates a single-use, unexpired token, sets the new
 * password, and marks the token used. All reset tokens for the user are invalidated.
 */
export async function POST(req: Request) {
  const rl = await rateLimit(`reset:${clientIp(req)}`, 10, 60 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: { message: "Too many attempts. Please try again later." } },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid JSON" } }, { status: 400 });
  }
  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: "Validation failed", fields: parsed.error.flatten().fieldErrors } },
      { status: 422 },
    );
  }

  try {
    const tokenHash = hashToken(parsed.data.token);
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      return NextResponse.json(
        { error: { message: "This reset link is invalid or has expired." } },
        { status: 400 },
      );
    }

    const passwordHash = await hashPassword(parsed.data.password);
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      // Invalidate any other outstanding tokens for this user.
      prisma.passwordResetToken.updateMany({
        where: { userId: record.userId, usedAt: null },
        data: { usedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ data: { message: "Your password has been reset." } }, { status: 200 });
  } catch (err) {
    logger.error({ err }, "reset-password failed");
    return NextResponse.json(
      { error: { message: "Could not reset your password. Please try again." } },
      { status: 500 },
    );
  }
}
