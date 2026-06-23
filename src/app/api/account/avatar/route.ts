import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getCurrentUser } from "@/lib/auth/session";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { uploadToStorage, STORAGE_BUCKET } from "@/lib/supabase/admin";
import { buildObjectKey, IMAGE_MIME, MAX_IMAGE_BYTES } from "@/lib/upload/validate";
import { setAvatar } from "@/services/account/profile";

export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED = IMAGE_MIME.filter((m) => m !== "image/svg+xml"); // no SVG avatars (XSS surface)

/** POST /api/account/avatar — multipart upload, stores to Supabase, sets User.image. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: { message: "Sign in required." } }, { status: 401 });

  const rl = await rateLimit(`avatar:${clientIp(req)}`, 10, 10 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: { message: "Too many uploads. Please wait." } }, { status: 429 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: { message: "No image uploaded." } }, { status: 400 });
  if (file.size === 0) return NextResponse.json({ error: { message: "Empty file." } }, { status: 400 });
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: { message: `Image exceeds ${Math.round(MAX_IMAGE_BYTES / 1048576)} MB limit.` } },
      { status: 413 },
    );
  }
  if (!ALLOWED.includes(file.type as (typeof ALLOWED)[number])) {
    return NextResponse.json({ error: { message: "Use a JPG, PNG or WebP image." } }, { status: 415 });
  }

  const key = buildObjectKey(`avatars/${user.id}`, file.name, randomUUID());
  const bytes = Buffer.from(await file.arrayBuffer());
  try {
    const stored = await uploadToStorage(STORAGE_BUCKET, key, bytes, file.type || "image/jpeg");
    await setAvatar(user.id, stored.url);
    return NextResponse.json({ data: { image: stored.url } }, { status: 201 });
  } catch (err) {
    logger.error({ err }, "avatar upload failed");
    return NextResponse.json({ error: { message: "Could not upload image." } }, { status: 502 });
  }
}
