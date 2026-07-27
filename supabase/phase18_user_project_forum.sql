-- Phase 18: sub-projects + mini forum on user projects.
--
-- 1. Adds parent_project_id to user_projects (nullable self-ref) so a
--    project can be listed as a sub-project of another. The tree is
--    flat in practice — one level of nesting is what the UI shows —
--    but the schema allows arbitrary depth if we ever want it.
-- 2. Adds a user_project_posts table for the mini forum on each
--    user project. Mirrors public.project_posts (used by the heavy
--    flagship projects) so the same hold/filter/dedupe/edit flow
--    works with minimal new code.

alter table public.user_projects
  add column if not exists parent_project_id uuid
    references public.user_projects(id) on delete set null;

create index if not exists user_projects_parent_idx
  on public.user_projects (parent_project_id, created_at desc);


create table if not exists public.user_project_posts (
  id                uuid        primary key default gen_random_uuid(),
  user_project_id   uuid        not null references public.user_projects(id) on delete cascade,
  parent_post_id    uuid        references public.user_project_posts(id) on delete cascade,
  author_id         uuid        not null references public.users(id) on delete cascade,
  content           text        not null check (char_length(content) between 1 and 20000),
  hold_state        text        not null default 'none' check (hold_state in ('none', 'held')),
  hold_reasons      text[],
  hold_expires_at   timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists user_project_posts_project_idx
  on public.user_project_posts (user_project_id, created_at desc);
create index if not exists user_project_posts_parent_idx
  on public.user_project_posts (parent_post_id, created_at);
create index if not exists user_project_posts_author_idx
  on public.user_project_posts (author_id, created_at desc);

alter table public.user_project_posts enable row level security;

drop policy if exists "user_project_posts: read for authenticated"
  on public.user_project_posts;
create policy "user_project_posts: read for authenticated"
  on public.user_project_posts for select to authenticated using (true);

drop policy if exists "user_project_posts: insert by author"
  on public.user_project_posts;
create policy "user_project_posts: insert by author"
  on public.user_project_posts for insert to authenticated
  with check (author_id = auth.uid());

drop policy if exists "user_project_posts: update by author"
  on public.user_project_posts;
create policy "user_project_posts: update by author"
  on public.user_project_posts for update to authenticated
  using  (author_id = auth.uid())
  with check (author_id = auth.uid());

drop policy if exists "user_project_posts: delete by author"
  on public.user_project_posts;
create policy "user_project_posts: delete by author"
  on public.user_project_posts for delete to authenticated
  using (author_id = auth.uid());
