import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { answer } from "@/services/assistant/assistant";

export const runtime = "nodejs";

const schema = z.object({ message: z.string().trim().min(1).max(500) });

/** POST /api/assistant — deterministic e-commerce assistant reply. */
export async function POST(req: Request) {
  const rl = await rateLimit(`assistant:${clientIp(req)}`, 40, 5 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: { message: "Too many messages. Please slow down." } }, { status: 429 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid JSON" } }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: { message: "Say that again?" } }, { status: 422 });

  const user = await getCurrentUser();
  const reply = await answer(parsed.data.message, user?.role === "CUSTOMER" ? user.id : null);
  return NextResponse.json({ data: reply });
}
