import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { forgotPasswordSchema } from "@/validations/auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { generateResetToken, RESET_TOKEN_TTL_MS } from "@/lib/auth/tokens";
import { sendPasswordResetEmail } from "@/lib/email/notify";
import { logger } from "@/lib/logger";

/**
 * Request a password reset. Always responds 200 with the same body whether or not
 * the email exists, to prevent account enumeration. A hashed, single-use token is
 * stored and the raw token is emailed.
 */
export async function POST(req: Request) {
  const rl = await rateLimit(`forgot:${clientIp(req)}`, 5, 60 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: { message: "Too many requests. Please try again later." } },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid JSON" } }, { status: 400 });
  }
  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: { message: "Enter a valid email." } }, { status: 422 });
  }
  const email = parsed.data.email.toLowerCase();

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user && user.isActive) {
      const { token, tokenHash } = generateResetToken();
      await prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
      });
      void sendPasswordResetEmail(email, user.name ?? "", token);
    }
  } catch (err) {
    // Never leak failures to the caller; log for ops.
    logger.error({ err }, "forgot-password failed");
  }

  return NextResponse.json(
    { data: { message: "If an account exists for that email, a reset link has been sent." } },
    { status: 200 },
  );
}
