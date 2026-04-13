/*
 * pleasejudgemefairly - Phase 3 migration
 *
 * Run this once in the Supabase SQL editor after the Phase 1 schema and
 * Phase 2 migration have already been applied. It adds:
 *
 *   1. Columns on `posts` to cache the cross-perspective helpfulness score
 *      and to track the "held for review" state used by the content filter.
 *   2. A `collapse_log` table that records every collapse/release event so
 *      the system can be audited (admin-readable only).
 *   3. A tighter read policy on `ratings` so individual votes are private
 *      to the voter. Aggregate scores are cached on `posts` and only the
 *      cron job (service role) reads the full ratings table.
 */

------------------------------------------------------------------
-- 1. Extend `posts` with rating and hold columns
------------------------------------------------------------------
alter table public.posts
  add column if not exists helpfulness_score numeric,
  add column if not exists rating_count       integer not null default 0,
  add column if not exists is_collapsed       boolean not null default false,
  add column if not exists hold_state         text    not null default 'none'
                             check (hold_state in ('none', 'held', 'released')),
  add column if not exists hold_reasons       text[],
  add column if not exists hold_expires_at    timestamptz,
  add column if not exists released_at        timestamptz,
  add column if not exists released_by        text
                             check (released_by in ('auto', 'admin'));

create index if not exists posts_hold_state_idx
  on public.posts (hold_state)
  where hold_state = 'held';

create index if not exists posts_is_collapsed_idx
  on public.posts (is_collapsed)
  where is_collapsed = true;

------------------------------------------------------------------
-- 2. collapse_log - audit trail for rating / hold events
------------------------------------------------------------------
create table if not exists public.collapse_log (
  id                 uuid primary key default gen_random_uuid(),
  post_id            uuid references public.posts(id) on delete cascade,
  event              text not null
                       check (event in ('collapsed', 'uncollapsed',
                                        'held', 'released', 'hold_expired')),
  helpfulness_score  numeric,
  rating_count       integer,
  reason             text,
  details            jsonb,
  created_at         timestamptz not null default now()
);

create index if not exists collapse_log_post_idx
  on public.collapse_log (post_id, created_at desc);

alter table public.collapse_log enable row level security;

-- No policies granted to anon or authenticated, which means only the
-- service role (used by the cron job) can read or write. Regular users
-- cannot see this table at all.

------------------------------------------------------------------
-- 3. Tighten ratings read policy - individual votes are private
------------------------------------------------------------------
-- Previously: "ratings: read all" let any authenticated user see every
-- rating row. That leaks raw counts, which violates the "no scores, no
-- leaderboards" rule. From now on, each user only reads their own votes;
-- aggregates live on posts.helpfulness_score / posts.rating_count, which
-- are computed by the cron job (service role, bypasses RLS).
drop policy if exists "ratings: read all"   on public.ratings;
drop policy if exists "ratings: read own"   on public.ratings;
create policy "ratings: read own"
  on public.ratings for select
  to authenticated
  using (auth.uid() = user_id);
