/*
 * a place for you - Phase 22 migration: /code (decoded ciphers)
 *
 * A section for sharing broken codes and how they were decoded. Users
 * submit; admin approves; only published ciphers show on /code.
 *
 * The animation for each cipher lives as static files under
 *   public/code-assets/<animation_slug>/index.html
 * and the detail page iframes it in. Uploading those files is a repo
 * action (drop a folder in), not a browser upload - the schema just
 * stores the slug that names the folder.
 *
 * Fields:
 *   title             human title
 *   summary           one-line hook
 *   cipher_text       the raw cipher (e.g. "OUOSVAVV DM")
 *   decoded_reading   what it decodes to (e.g. "O you, to those...")
 *   method            long-form write-up of how it was decoded
 *   sources           links / citations (plain text)
 *   animation_slug    /code-assets/<animation_slug>/ folder
 *   status            pending | published | rejected
 *
 * Slug (URL) is separate from animation_slug so admin can rename the
 * page slug without moving the animation folder, and vice versa.
 *
 * Run this once in the Supabase SQL editor after phase 21.
 */

create table if not exists public.code_ciphers (
  id                uuid        primary key default gen_random_uuid(),
  slug              text        not null unique,
  title             text        not null check (char_length(title) between 1 and 200),
  summary           text        not null check (char_length(summary) between 1 and 500),
  cipher_text       text        not null check (char_length(cipher_text) between 1 and 2000),
  decoded_reading   text        not null check (char_length(decoded_reading) between 1 and 5000),
  method            text        not null check (char_length(method) between 1 and 20000),
  sources           text        check (sources is null or char_length(sources) <= 5000),
  animation_slug    text        check (animation_slug is null or animation_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  submitter_id      uuid        not null references public.users(id) on delete cascade,
  status            text        not null default 'pending'
                                check (status in ('pending', 'published', 'rejected')),
  reviewed_by       uuid        references public.users(id) on delete set null,
  reviewed_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.code_ciphers
  add constraint code_ciphers_slug_format
  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 60);

create index if not exists code_ciphers_status_idx
  on public.code_ciphers (status, created_at desc);

------------------------------------------------------------------
-- RLS: readers see published rows (or their own pending). Inserts
-- are self-only and forced to 'pending'. Approvals and rejections
-- go through the service-role client from admin actions, so no
-- policy on update/delete is exposed here.
------------------------------------------------------------------
alter table public.code_ciphers enable row level security;

create policy "code_ciphers: read published or own"
  on public.code_ciphers for select to authenticated
  using (status = 'published' or submitter_id = auth.uid());

create policy "code_ciphers: insert own pending"
  on public.code_ciphers for insert to authenticated
  with check (submitter_id = auth.uid() and status = 'pending');
