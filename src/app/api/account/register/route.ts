import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { registerSchema } from "@/validations/auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { sendWelcomeEmail } from "@/lib/email/notify";
import { logger } from "@/lib/logger";

/**
 * Customer self-registration. Creates a User with the CUSTOMER role and a linked
 * CRM Customer record. Email-only (no SMS/phone verification). The client signs
 * in via NextAuth credentials after a 201.
 */
export async function POST(req: Request) {
  const rl = rateLimit(`register:${clientIp(req)}`, 5, 60 * 60 * 1000); // 5/hour/IP
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

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: "Validation failed", fields: parsed.error.flatten().fieldErrors } },
      { status: 422 },
    );
  }
  const d = parsed.data;
  const email = d.email.toLowerCase();

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: { message: "An account with this email already exists." } },
        { status: 409 },
      );
    }

    const role = await prisma.role.findUnique({ where: { key: "CUSTOMER" } });
    if (!role) {
      logger.error("CUSTOMER role missing — run the seed");
      return NextResponse.json(
        { error: { message: "Registration is temporarily unavailable." } },
        { status: 503 },
      );
    }

    const passwordHash = await hashPassword(d.password);
    const user = await prisma.user.create({
      data: {
        email,
        name: d.name,
        passwordHash,
        roleId: role.id,
        customer: {
          create: {
            name: d.name,
            email,
            phone: d.phone || null,
            company: d.company || null,
          },
        },
      },
    });

    void sendWelcomeEmail(email, d.name);

    return NextResponse.json({ data: { id: user.id, email } }, { status: 201 });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      return NextResponse.json(
        { error: { message: "An account with this email already exists." } },
        { status: 409 },
      );
    }
    logger.error({ err }, "register failed");
    return NextResponse.json(
      { error: { message: "Could not create your account. Please try again." } },
      { status: 500 },
    );
  }
}
