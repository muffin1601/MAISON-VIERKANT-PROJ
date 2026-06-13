"use client";

import { useCallback, useState } from "react";
import { showToast } from "@/lib/toast";

const COMPRESS_OVER = 1024 * 1024;
const MAX_DIMENSION = 2000;

export type UploadCategory = "product-image" | "drawing" | "document" | "catalogue";

export interface UploadedAsset {
  url: string;
  bucket: string;
  key: string;
  filename: string;
  mimeType: string | null;
  sizeBytes: number;
  isPdf: boolean;
}

/**
 * Client upload hook — browser-side compression (images), progress, retry, posting to
 * /api/admin/upload with a storage category. Single source of truth for admin uploads.
 */
export function useUpload() {
  const [progress, setProgress] = useState<number | null>(null);
  const uploading = progress !== null;

  const upload = useCallback(
    async (file: File, category: UploadCategory = "product-image", attempt = 0): Promise<UploadedAsset | null> => {
      const prepared = category === "product-image" ? await compressImage(file) : file;
      const body = new FormData();
      body.append("file", prepared, prepared.name);
      body.append("category", category);

      try {
        return await new Promise<UploadedAsset | null>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", "/api/admin/upload");
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
          };
          xhr.onload = () => {
            setProgress(null);
            try {
              const json = JSON.parse(xhr.responseText);
              if (xhr.status >= 200 && xhr.status < 300 && json.data?.url) {
                const d = json.data;
                resolve({
                  url: d.url,
                  bucket: d.bucket,
                  key: d.key,
                  filename: d.filename ?? file.name,
                  mimeType: d.mimeType ?? file.type ?? null,
                  sizeBytes: d.sizeBytes ?? file.size,
                  isPdf: (d.mimeType ?? file.type) === "application/pdf",
                });
              } else if (xhr.status >= 400 && xhr.status < 500) {
                showToast(json.error?.message ?? "Upload rejected");
                resolve(null); // client error — don't retry
              } else {
                reject(new Error(json.error?.message ?? "Upload failed"));
              }
            } catch {
              reject(new Error("Upload failed"));
            }
          };
          xhr.onerror = () => reject(new Error("Network error"));
          xhr.send(body);
        });
      } catch (err) {
        setProgress(null);
        // Auto-retry transient (network / 5xx) errors up to 2 times with backoff.
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
          return upload(file, category, attempt + 1);
        }
        showToast(`${file.name}: ${err instanceof Error ? err.message : "upload failed"}`);
        return null;
      }
    },
    [],
  );

  return { upload, uploading, progress };
}

/** Delete a stored object (used by Replace/Delete in uploaders). */
export async function deleteAsset(bucket: string, key: string): Promise<boolean> {
  try {
    const res = await fetch("/api/admin/upload/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bucket, key }),
    });
    const json = await res.json();
    return !!json.data?.ok;
  } catch {
    return false;
  }
}

async function compressImage(file: File): Promise<File> {
  if (file.type === "image/svg+xml" || file.size < COMPRESS_OVER) return file;
  if (typeof document === "undefined" || typeof createImageBitmap === "undefined") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob: Blob | null = await new Promise((res) => canvas.toBlob((b) => res(b), "image/webp", 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", { type: "image/webp" });
  } catch {
    return file;
  }
}
