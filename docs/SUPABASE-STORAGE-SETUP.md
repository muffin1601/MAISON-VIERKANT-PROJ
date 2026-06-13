# Supabase Storage Setup — Product Image & Drawing Uploads

The admin "Edit Product" form now uploads **hero images, lifestyle photos, and technical
drawings** directly to Supabase Storage instead of asking for pasted URLs. Follow these
steps once per environment (local, staging, production).

---

## 1. Create the storage bucket

**Dashboard route (easiest):**
1. Open your project at <https://supabase.com/dashboard> → **Storage** → **New bucket**.
2. Name it **`mvi-media`** (must match `SUPABASE_STORAGE_BUCKET`).
3. Set it **Public** (so product photos render on the public storefront via `getPublicUrl`).
4. Optional: set "File size limit" to **8 MB** and allowed MIME types to
   `image/jpeg, image/png, image/webp, image/svg+xml, application/pdf`.
5. Create.

**Or via SQL** (Storage → SQL, or the SQL Editor):
```sql
insert into storage.buckets (id, name, public)
values ('mvi-media', 'mvi-media', true)
on conflict (id) do update set public = true;
```

---

## 2. Storage access policies (RLS)

The app **uploads with the service-role key** (server-side only — `src/lib/supabase/admin.ts`),
which **bypasses RLS**, so no INSERT policy is strictly required for uploads. You only need a
**public READ** policy so browsers can fetch the images:

```sql
-- Allow anyone to read objects in the mvi-media bucket (public product images).
create policy "Public read mvi-media"
on storage.objects for select
to public
using ( bucket_id = 'mvi-media' );
```

> A public bucket already serves files at a public URL; this policy makes the intent explicit
> and is required if you keep the bucket *private* and switch to signed URLs later.

If you ever want **client-side** uploads (not used today), add an authenticated INSERT policy.
Not needed for the current server-upload design.

---

## 3. Environment variables

Add these to `.env` (local) and to your Vercel project settings (production). The first two
come from **Project Settings → API**; the service-role key is the **secret** one — never expose
it to the browser.

```bash
NEXT_PUBLIC_SUPABASE_URL="https://<your-ref>.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="<service-role-secret-key>"   # Settings → API → service_role
SUPABASE_STORAGE_BUCKET="mvi-media"
```

`NEXT_PUBLIC_SUPABASE_URL` is also used to build the public image URLs, so it must be the real
project URL. `SUPABASE_SERVICE_ROLE_KEY` is read **only on the server**.

> Security note: the service-role key bypasses all RLS. It is imported exclusively from
> `src/lib/supabase/admin.ts`, which is only used inside API route handlers — never in a
> client component. Do not add `NEXT_PUBLIC_` to it.

---

## 4. next.config.ts (already done)

`next.config.ts` already allows Supabase image hosts:
```ts
images: { remotePatterns: [{ protocol: "https", hostname: "**.supabase.co" }] }
```
No change needed.

---

## 5. How it works end-to-end

1. Admin clicks **Upload Image / + Add Photos / + Upload Drawings** in the product editor.
2. The browser validates type & size and **compresses large rasters to WebP** (`useUpload`).
3. It POSTs the file to **`/api/admin/upload`** (requires the `products.write` permission).
4. The route validates again server-side, stores the object in `mvi-media/products|drawings/…`,
   records an `UploadedFile` row for audit, and returns the **public URL**.
5. The URL is saved on the product as a `ProductImage` row with `type` = `HERO` / `GALLERY` /
   `DRAWING`. The public site reads images by type (drawings are excluded from the gallery).

**Limits / formats:** JPG · JPEG · PNG · WEBP · SVG for photos; drawings also accept **PDF**.
Max 8 MB per file (see `src/lib/upload/validate.ts` to change).

---

## 6. Verify

1. `npm run dev`, log in as an admin with `products.write` (Super Admin / Admin).
2. Products → open a product → **Upload Image** → pick a JPG. The preview should appear.
3. **Save & Update Website** → reopen the product: the image persists.
4. Check the Supabase dashboard → Storage → `mvi-media` → `products/` for the object.

**Troubleshooting**
- *"Supabase storage is not configured"* → env vars missing/empty; restart the dev server after editing `.env`.
- *Image broken on the public site* → bucket isn't Public, or `NEXT_PUBLIC_SUPABASE_URL` is wrong.
- *403 on upload* → the logged-in role lacks `products.write`.
- *502 "Upload failed"* → bucket `mvi-media` doesn't exist, or the service-role key is invalid.
</content>
