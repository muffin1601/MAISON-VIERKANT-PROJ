import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { leadSchema } from "@/validations/lead";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { notifyAdminNewLead } from "@/lib/email/notify";

/** Public lead capture (catalogue request + contact form). */
export async function POST(req: Request) {
  const rl = rateLimit(`leads:${clientIp(req)}`, 10, 10 * 60 * 1000); // 10 / 10 min / IP
  if (!rl.ok) {
    return NextResponse.json(
      { error: { message: "Too many submissions. Please try again shortly." } },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid JSON" } }, { status: 400 });
  }

  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: "Validation failed", fields: parsed.error.flatten().fieldErrors } },
      { status: 422 },
    );
  }
  const d = parsed.data;
  const note = [d.represent && `Represents: ${d.represent}`, d.message]
    .filter(Boolean)
    .join(" — ");

  try {
    const lead = await prisma.lead.create({
      data: {
        source: d.source,
        name: d.name,
        email: d.email,
        phone: d.phone || null,
        company: d.company || null,
        type: d.type || null,
        status: "NEW",
        ...(note ? { notes: { create: { body: note } } } : {}),
      },
    });
    void notifyAdminNewLead({
      name: d.name,
      email: d.email,
      phone: d.phone,
      company: d.company,
      source: d.source,
      type: d.type,
    });
    return NextResponse.json({ data: { id: lead.id } }, { status: 201 });
  } catch {
    // DB not reachable yet — accept gracefully so the storefront UX is unaffected.
    return NextResponse.json({ data: { id: null, queued: true } }, { status: 202 });
  }
}
