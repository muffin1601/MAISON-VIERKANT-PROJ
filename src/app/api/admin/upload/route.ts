import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requirePermission, AuthError } from "@/lib/auth/session";
import { uploadToStorage } from "@/lib/supabase/admin";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import {
  validateForCategory,
  buildObjectKey,
  CATEGORY_RULES,
  type UploadCategory,
} from "@/lib/upload/validate";

export const maxDuration = 60;

const UPLOADED_KIND: Record<UploadCategory, string> = {
  "product-image": "MEDIA",
  drawing: "DRAWING",
  document: "DOCUMENT",
  catalogue: "DOCUMENT",
  "price-list": "PRICE_LIST",
  "payment-qr": "MEDIA",
};

/**
 * Authenticated media/document upload → Supabase Storage. Category-driven (bucket + MIME +
 * size rules in one place). Returns full file metadata and records an audit row.
 */
export async function POST(req: Request) {
  let user;
  try {
    user = await requirePermission("products.write");
  } catch (e) {
    const status = e instanceof AuthError && e.code === "UNAUTHENTICATED" ? 401 : 403;
    return NextResponse.json({ error: { message: "Not authorized" } }, { status });
  }

  const form = await req.formData();
  const file = form.get("file");
  const rawCategory = String(form.get("category") ?? "product-image") as UploadCategory;
  const rule = CATEGORY_RULES[rawCategory] ?? CATEGORY_RULES["product-image"];

  const v = validateForCategory(file, rule);
  if (!v.ok) return NextResponse.json({ error: { message: v.message } }, { status: v.status });
  const f = file as File;

  const key = buildObjectKey(rule.folder, f.name, randomUUID());
  const bytes = Buffer.from(await f.arrayBuffer());

  let stored;
  try {
    stored = await uploadToStorage(rule.bucket, key, bytes, f.type || "application/octet-stream");
  } catch (e) {
    return NextResponse.json(
      { error: { message: `Upload failed: ${e instanceof Error ? e.message : "storage error"}` } },
      { status: 502 },
    );
  }

  // Persist metadata + audit (non-fatal).
  try {
    await prisma.uploadedFile.create({
      data: {
        kind: UPLOADED_KIND[rawCategory] ?? "MEDIA",
        url: stored.url,
        storageKey: stored.key,
        bucket: stored.bucket,
        filename: f.name,
        mimeType: f.type || null,
        sizeBytes: f.size,
        parseStatus: "DONE",
        uploaderId: user.id,
      },
    });
  } catch {
    /* non-fatal */
  }
  await recordAudit({
    actorId: user.id,
    action: "file.upload",
    entity: "UploadedFile",
    entityId: stored.key,
    after: { bucket: stored.bucket, filename: f.name, size: f.size, category: rawCategory },
  });

  return NextResponse.json(
    {
      data: {
        url: stored.url,
        bucket: stored.bucket,
        key: stored.key,
        filename: f.name,
        mimeType: f.type || null,
        sizeBytes: f.size,
      },
    },
    { status: 201 },
  );
}
