-- Phase 12: user projects.
--
-- Lightweight, user-created projects (distinct from the heavy flagship
-- projects table, which stays as-is for large-scale community projects
-- with tiers, vision docs, and registrations of interest). Any signed-
-- in user can create a user_project by giving it a title, a short
-- description, a category, and a longer description. There are no
-- tiers, funding targets, or registrations here — it is just a way to
-- share what someone is working on.

create table if not exists public.user_projects (
  id                 uuid        primary key default gen_random_uuid(),
  creator_id         uuid        not null references public.users(id) on delete cascade,
  title              text        not null check (char_length(title) between 1 and 200),
  short_description  text        not null check (char_length(short_description) between 1 and 500),
  description        text        not null check (char_length(description) between 1 and 50000),
  category           text        not null check (category in (
    'community',
    'arts',
    'housing',
    'skills',
    'environment',
    'health',
    'justice',
    'business',
    'other'
  )),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists user_projects_category_idx
  on public.user_projects (category, created_at desc);

create index if not exists user_projects_creator_idx
  on public.user_projects (creator_id, created_at desc);

alter table public.user_projects enable row level security;

-- Anyone signed in can browse.
drop policy if exists "user_projects: read for authenticated" on public.user_projects;
create policy "user_projects: read for authenticated"
  on public.user_projects for select to authenticated using (true);

-- DB-level: creator_id must equal the current user on insert.
drop policy if exists "user_projects: insert by creator" on public.user_projects;
create policy "user_projects: insert by creator"
  on public.user_projects for insert to authenticated
  with check (creator_id = auth.uid());

drop policy if exists "user_projects: update by creator" on public.user_projects;
create policy "user_projects: update by creator"
  on public.user_projects for update to authenticated
  using  (creator_id = auth.uid())
  with check (creator_id = auth.uid());

drop policy if exists "user_projects: delete by creator" on public.user_projects;
create policy "user_projects: delete by creator"
  on public.user_projects for delete to authenticated
  using (creator_id = auth.uid());
