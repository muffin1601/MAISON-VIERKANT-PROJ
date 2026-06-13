import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission, AuthError } from "@/lib/auth/session";
import { deleteFromStorage } from "@/lib/supabase/admin";
import { recordAudit } from "@/lib/audit";

const schema = z.object({ bucket: z.string().min(1), key: z.string().min(1) });

/** Remove a previously-uploaded object from Supabase Storage. */
export async function POST(req: Request) {
  let user;
  try {
    user = await requirePermission("products.write");
  } catch (e) {
    const status = e instanceof AuthError && e.code === "UNAUTHENTICATED" ? 401 : 403;
    return NextResponse.json({ error: { message: "Not authorized" } }, { status });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid JSON" } }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: { message: "bucket and key required" } }, { status: 422 });
  }

  const ok = await deleteFromStorage(parsed.data.bucket, parsed.data.key);
  await recordAudit({
    actorId: user.id,
    action: "file.delete",
    entity: "UploadedFile",
    entityId: parsed.data.key,
    after: { bucket: parsed.data.bucket, ok },
  });
  return NextResponse.json({ data: { ok } });
}
