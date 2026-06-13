-- ============================================================================
-- Maison Vierkant — Supabase Storage setup
-- Run this in the Supabase SQL Editor (or psql). Idempotent — safe to re-run.
-- ============================================================================

-- 1) Buckets ---------------------------------------------------------------
-- products-images : hero + gallery product photos (public)
-- product-documents: brochures, spec/tech sheets, datasheets (public)
-- catalogues       : full catalogue PDFs (public)
-- drawings         : technical line art + CAD (public)
-- uploads          : misc admin uploads incl. price-list PDFs (public)
insert into storage.buckets (id, name, public)
values
  ('products-images',  'products-images',  true),
  ('product-documents','product-documents',true),
  ('catalogues',       'catalogues',       true),
  ('drawings',         'drawings',         true),
  ('uploads',          'uploads',          true)
on conflict (id) do update set public = excluded.public;

-- Optional: keep the legacy single bucket working too.
insert into storage.buckets (id, name, public)
values ('mvi-media', 'mvi-media', true)
on conflict (id) do nothing;

-- 2) Read policies ---------------------------------------------------------
-- Public read for all app buckets (product images must render on the storefront).
-- Writes/deletes are performed server-side with the service-role key (bypasses RLS),
-- so no public INSERT/DELETE policy is granted (defense in depth).
do $$
declare b text;
begin
  foreach b in array array[
    'products-images','product-documents','catalogues','drawings','uploads','mvi-media'
  ] loop
    -- drop+recreate to stay idempotent
    execute format(
      'drop policy if exists "public read %1$s" on storage.objects', b
    );
    execute format(
      'create policy "public read %1$s" on storage.objects
         for select to public using (bucket_id = %1$L)', b
    );
  end loop;
end $$;

-- 3) (Optional) tighten: make documents/catalogues private + use signed URLs
--    To do this, set the bucket(s) public = false above and REMOVE their read
--    policy; the app would then need to switch to createSignedUrl(). Not enabled
--    by default because product media is meant to be publicly viewable.

-- ============================================================================
-- Verify:
--   select id, public from storage.buckets order by id;
--   select policyname, cmd from pg_policies where tablename = 'objects';
-- ============================================================================
