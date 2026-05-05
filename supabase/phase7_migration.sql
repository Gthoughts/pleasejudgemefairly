/*
 * pleasejudgemefairly - Phase 7 migration: Projects
 *
 * Adds the Projects section: large-scale community projects with a tiered
 * registration-of-interest model. NO MONEY moves through the site. Tier
 * registrations are expressions of interest only; the cascading model is
 * explained in text and not enforced by the system.
 *
 * Tables:
 *   - projects
 *   - project_tiers
 *   - project_registrations
 *   - project_updates
 *   - project_posts (mirror of meetup_posts; supports per-update threads
 *     via update_id and a full project discussion when update_id is null)
 *
 * Reuses the existing ratings and flags tables with content_type = 'project_post'.
 *
 * Run this once in the Supabase SQL editor after phases 1-5 are in place.
 */

-- 1. projects -------------------------------------------------------
create table public.projects (
  id                 uuid        primary key default gen_random_uuid(),
  title              text        not null check (char_length(title) between 1 and 200),
  short_description  text        not null check (char_length(short_description) between 1 and 500),
  vision_content     text        not null check (char_length(vision_content) between 1 and 200000),
  model_content      text        not null check (char_length(model_content) between 1 and 200000),
  pdf_url            text        check (pdf_url is null or char_length(pdf_url) <= 1000),
  creator_id         uuid        not null references public.users(id) on delete cascade,
  status             text        not null default 'active'
                                 check (status in ('active', 'completed', 'paused')),
  funding_target     numeric     not null default 25800000 check (funding_target >= 0),
  per_person_target  numeric     not null default 8600 check (per_person_target >= 0),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index projects_status_idx on public.projects (status, created_at desc);

alter table public.projects enable row level security;

-- Anyone signed in can browse projects.
create policy "projects: read for authenticated"
  on public.projects for select to authenticated using (true);

-- DB-level: an authenticated user can only insert a row whose creator_id
-- is themselves. Admin-only enforcement is layered in the server action.
create policy "projects: insert by creator"
  on public.projects for insert to authenticated
  with check (creator_id = auth.uid());

create policy "projects: update by creator"
  on public.projects for update to authenticated
  using  (creator_id = auth.uid())
  with check (creator_id = auth.uid());

create policy "projects: delete by creator"
  on public.projects for delete to authenticated
  using (creator_id = auth.uid());

-- 2. project_tiers --------------------------------------------------
create table public.project_tiers (
  id                       uuid    primary key default gen_random_uuid(),
  project_id               uuid    not null references public.projects(id) on delete cascade,
  name                     text    not null check (char_length(name) between 1 and 100),
  upfront_amount           numeric not null check (upfront_amount >= 0),
  monthly_amount           numeric not null check (monthly_amount >= 0),
  monthly_duration_months  integer not null check (monthly_duration_months >= 0),
  total_amount             numeric not null check (total_amount >= 0),
  target_slots             integer not null check (target_slots > 0),
  phase_choice             boolean not null default false,
  display_order            integer not null default 0,
  created_at               timestamptz not null default now()
);

create index project_tiers_project_idx
  on public.project_tiers (project_id, display_order);

alter table public.project_tiers enable row level security;

create policy "project_tiers: read for authenticated"
  on public.project_tiers for select to authenticated using (true);

create policy "project_tiers: manage by creator"
  on public.project_tiers for all to authenticated
  using (exists (
    select 1 from public.projects p
    where p.id = project_id and p.creator_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.projects p
    where p.id = project_id and p.creator_id = auth.uid()
  ));

-- 3. project_registrations ------------------------------------------
-- One row per (project, user). Holds the user's expression of interest.
-- Individual registration details are NOT public — only the registrant
-- and the project creator can read full rows. Aggregate counts for the
-- public summary are exposed via SECURITY DEFINER functions below.
create table public.project_registrations (
  id                uuid    primary key default gen_random_uuid(),
  project_id        uuid    not null references public.projects(id) on delete cascade,
  user_id           uuid    not null references public.users(id) on delete cascade,
  tier_id           uuid    not null references public.project_tiers(id) on delete restrict,
  skills_text       text    not null default '' check (char_length(skills_text) <= 500),
  location_text     text    not null default '' check (char_length(location_text) <= 200),
  motivation_text   text    not null default '' check (char_length(motivation_text) <= 500),
  availability      text    not null check (availability in (
    'weekends','weekdays','both','flexible','relocate'
  )),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (project_id, user_id)
);

create index project_registrations_project_idx
  on public.project_registrations (project_id);
create index project_registrations_tier_idx
  on public.project_registrations (tier_id);

alter table public.project_registrations enable row level security;

create policy "project_registrations: read own or creator"
  on public.project_registrations for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.projects p
      where p.id = project_id and p.creator_id = auth.uid()
    )
  );

create policy "project_registrations: insert own"
  on public.project_registrations for insert to authenticated
  with check (user_id = auth.uid());

create policy "project_registrations: update own"
  on public.project_registrations for update to authenticated
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "project_registrations: delete own"
  on public.project_registrations for delete to authenticated
  using (user_id = auth.uid());

-- Aggregate helpers — return ONLY counts so the public page can show
-- the total interest and per-tier breakdown without leaking any
-- individual rows. Bypass RLS via security definer.
create or replace function public.project_registration_count(p_project_id uuid)
returns bigint
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::bigint
  from public.project_registrations
  where project_id = p_project_id;
$$;

create or replace function public.project_tier_breakdown(p_project_id uuid)
returns table (tier_id uuid, registration_count bigint)
language sql
security definer
set search_path = public
stable
as $$
  select tier_id, count(*)::bigint
  from public.project_registrations
  where project_id = p_project_id
  group by tier_id;
$$;

revoke all on function public.project_registration_count(uuid) from public;
revoke all on function public.project_tier_breakdown(uuid) from public;
grant execute on function public.project_registration_count(uuid) to authenticated;
grant execute on function public.project_tier_breakdown(uuid) to authenticated;

-- 4. project_updates -------------------------------------------------
create table public.project_updates (
  id          uuid    primary key default gen_random_uuid(),
  project_id  uuid    not null references public.projects(id) on delete cascade,
  title       text    not null check (char_length(title) between 1 and 200),
  content     text    not null check (char_length(content) between 1 and 50000),
  author_id   uuid    not null references public.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index project_updates_project_idx
  on public.project_updates (project_id, created_at desc);

alter table public.project_updates enable row level security;

create policy "project_updates: read for authenticated"
  on public.project_updates for select to authenticated using (true);

create policy "project_updates: manage by creator"
  on public.project_updates for all to authenticated
  using (exists (
    select 1 from public.projects p
    where p.id = project_id and p.creator_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.projects p
    where p.id = project_id and p.creator_id = auth.uid()
  ));

-- 5. project_posts ---------------------------------------------------
-- Mirrors the meetup_posts table. update_id distinguishes posts that
-- live under a specific progress update (Section 4) from posts in the
-- main project discussion (Section 5, where update_id is null).
-- Ratings and flags reuse the existing ratings/flags tables with
-- content_type = 'project_post'.
create table public.project_posts (
  id              uuid    primary key default gen_random_uuid(),
  project_id      uuid    not null references public.projects(id) on delete cascade,
  update_id       uuid    references public.project_updates(id) on delete cascade,
  parent_post_id  uuid    references public.project_posts(id) on delete cascade,
  author_id       uuid    not null references public.users(id) on delete cascade,
  content         text    not null check (char_length(content) between 1 and 20000),
  is_pinned       boolean not null default false,
  is_collapsed    boolean not null default false,
  hold_state      text    not null default 'none'
                          check (hold_state in ('none', 'held', 'released')),
  hold_reasons    text[],
  hold_expires_at timestamptz,
  released_at     timestamptz,
  released_by     uuid    references public.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index project_posts_project_idx
  on public.project_posts (project_id, created_at);
create index project_posts_update_idx
  on public.project_posts (update_id, created_at)
  where update_id is not null;
create index project_posts_parent_idx
  on public.project_posts (parent_post_id);

alter table public.project_posts enable row level security;

create policy "project_posts: read for authenticated"
  on public.project_posts for select to authenticated using (true);

create policy "project_posts: insert own"
  on public.project_posts for insert to authenticated
  with check (author_id = auth.uid());

create policy "project_posts: update by author"
  on public.project_posts for update to authenticated
  using  (author_id = auth.uid())
  with check (author_id = auth.uid());

create policy "project_posts: update by creator"
  on public.project_posts for update to authenticated
  using (exists (
    select 1 from public.projects p
    where p.id = project_id and p.creator_id = auth.uid()
  ));

create policy "project_posts: delete by author"
  on public.project_posts for delete to authenticated
  using (author_id = auth.uid());

create policy "project_posts: delete by creator"
  on public.project_posts for delete to authenticated
  using (exists (
    select 1 from public.projects p
    where p.id = project_id and p.creator_id = auth.uid()
  ));

-- 6. Widen ratings/flags content_type to include 'project_post' ------
-- The existing constraints were written before meetups and projects
-- were added, so we re-create them defensively to include all current
-- content types. Drop-then-add is safe because every row already
-- contains one of the listed values.
alter table public.ratings drop constraint if exists ratings_content_type_check;
alter table public.ratings
  add constraint ratings_content_type_check
  check (content_type in ('post', 'resource', 'meetup_post', 'project_post'));

alter table public.flags drop constraint if exists flags_content_type_check;
alter table public.flags
  add constraint flags_content_type_check
  check (content_type in ('post', 'resource', 'thread', 'meetup_post', 'project_post'));
