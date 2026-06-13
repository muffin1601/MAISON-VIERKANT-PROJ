import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client using the service-role key. NEVER import this from a
 * client component — the service role bypasses RLS. Used for media uploads to the
 * `mvi-media` storage bucket.
 */
let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Supabase storage is not configured (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing).",
    );
  }
  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "mvi-media";

export interface StoredObject {
  url: string;
  bucket: string;
  key: string;
}

/** Upload bytes to a bucket/key and return the public URL. Throws on storage error. */
export async function uploadToStorage(
  bucket: string,
  key: string,
  bytes: Buffer,
  contentType: string,
): Promise<StoredObject> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from(bucket).upload(key, bytes, {
    contentType,
    upsert: false,
    cacheControl: "31536000",
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(bucket).getPublicUrl(key);
  return { url: data.publicUrl, bucket, key };
}

/** Remove an object from storage. Best-effort; returns false on failure. */
export async function deleteFromStorage(bucket: string, key: string): Promise<boolean> {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.storage.from(bucket).remove([key]);
    return !error;
  } catch {
    return false;
  }
}
