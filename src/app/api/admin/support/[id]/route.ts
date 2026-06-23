import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

const schema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]).optional(),
  adminNote: z.string().trim().max(2000).optional(),
});

/** PATCH /api/admin/support/:id — update ticket status / internal note. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requirePermission("leads.write");
  } catch (e) {
    const status = e instanceof AuthError && e.code === "UNAUTHENTICATED" ? 401 : 403;
    return NextResponse.json({ error: { message: "Not authorized" } }, { status });
  }
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid JSON" } }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: { message: "Invalid request" } }, { status: 422 });
  try {
    const t = await prisma.supportTicket.update({
      where: { id },
      data: {
        ...(parsed.data.status && { status: parsed.data.status }),
        ...(parsed.data.adminNote !== undefined && { adminNote: parsed.data.adminNote || null }),
      },
    });
    await recordAudit({ actorId: user.id, action: "support.update", entity: "SupportTicket", entityId: t.id, after: { status: t.status } });
    return NextResponse.json({ data: { id: t.id, status: t.status } });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2025") {
      return NextResponse.json({ error: { message: "Ticket not found." } }, { status: 404 });
    }
    logger.error({ err }, "support update failed");
    return NextResponse.json({ error: { message: "Could not update ticket." } }, { status: 500 });
  }
}
