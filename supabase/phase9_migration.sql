-- Phase 9: PDF-hosted library resources.
--
-- Adds a `pdf_path` column to `resources` so a library entry can point
-- at a self-hosted PDF stored in Supabase Storage instead of (or in
-- addition to) an external URL. The url column is relaxed to nullable
-- so a PDF-only resource is allowed, with a check constraint enforcing
-- that at least one of url or pdf_path is present on every row.
--
-- Creates the `library-pdfs` bucket: public read (so anyone can
-- download without a signed URL), 25 MB per-object limit, application/
-- pdf only. Writes to the bucket are gated by the app via signed upload
-- URLs generated in an admin-only server action, so no storage.objects
-- INSERT policy is needed.

--------------------------------------------------------------------
-- 1. resources column changes
--------------------------------------------------------------------

alter table public.resources
  add column if not exists pdf_path text;

alter table public.resources
  alter column url drop not null;

-- If a previous run of this migration added the constraint, drop and
-- recreate so we can be sure it exists with the right definition.
alter table public.resources
  drop constraint if exists resources_link_or_pdf_check;

alter table public.resources
  add constraint resources_link_or_pdf_check
  check (url is not null or pdf_path is not null);

--------------------------------------------------------------------
-- 2. library-pdfs storage bucket
--------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'library-pdfs',
  'library-pdfs',
  true,                      -- public read: direct download URLs
  26214400,                  -- 25 MB
  array['application/pdf']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

--------------------------------------------------------------------
-- 3. Read policy on storage.objects for the library-pdfs bucket
--    (bucket is public, but an explicit policy documents intent).
--------------------------------------------------------------------

drop policy if exists "library-pdfs: public read" on storage.objects;
create policy "library-pdfs: public read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'library-pdfs');

-- No INSERT/UPDATE/DELETE policies: writes only via the service-role
-- client from an admin-verified server action.
