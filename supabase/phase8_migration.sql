/*
 * The Accord - Phase 8 migration: Subscribers (landing-page email capture)
 *
 * Run this once in the Supabase SQL editor after phases 1-5 and 7 are in
 * place. Adds a single table to capture email sign-ups from the
 * /Merseyside landing page (and any future regional landings).
 *
 * Design:
 *   - Anyone (including anonymous visitors) can INSERT a row, because
 *     the landing page is public and the signup form runs without auth.
 *   - No SELECT policy is granted to anon or authenticated, which means
 *     only the service-role key can read rows. The dashboard and any
 *     server-side export tool authenticate as service-role.
 *   - email is unique. Duplicate inserts surface a friendly "you are
 *     already on the list" message from the server action.
 *   - region is nullable. The Merseyside landing defaults it to
 *     'Merseyside' server-side; future regional pages pass their own.
 *
 * IMPORTANT: the server action calls `.insert()` WITHOUT `.select()`.
 * Returning the inserted row would require a SELECT policy, which on
 * purpose does not exist (subscriber emails are not readable by anon).
 */

create table if not exists public.subscribers (
  id         uuid        primary key default gen_random_uuid(),
  email      text        not null unique,
  region     text,
  created_at timestamptz not null default now()
);

create index if not exists subscribers_region_idx
  on public.subscribers (region);
create index if not exists subscribers_created_at_idx
  on public.subscribers (created_at desc);

alter table public.subscribers enable row level security;
-- Make sure RLS is not in FORCE mode. With FORCE on, even the table
-- owner is subject to policies, which can mask configuration issues
-- during diagnosis. Off is the safe default for this table.
alter table public.subscribers no force row level security;

-- An RLS policy alone is not enough — the underlying table privilege
-- must also allow INSERT. Supabase grants this by default for tables
-- in the public schema, but stating it explicitly makes the migration
-- portable to fresh projects.
grant insert on public.subscribers to anon, authenticated;

-- Anyone (anon or authenticated) can add their email.
create policy "anon_insert_open"
  on public.subscribers
  as permissive
  for insert
  to anon, authenticated
  with check (true);

-- No SELECT / UPDATE / DELETE policies on purpose. The service role
-- bypasses RLS, so dashboards / exports run as service-role. Regular
-- visitors and signed-in users cannot read the list.
