/*
 * pleasejudgemefairly - initial database schema
 *
 * Run this in the Supabase SQL Editor against a fresh project (or pipe it
 * through `supabase db push` once the CLI is wired up).
 *
 * Notes:
 *  - All tables live in the `public` schema.
 *  - Row Level Security is enabled on every table.
 *  - Policies implement the Phase 1 rule: "users can only edit their own
 *    data". Reading is open to authenticated users where that makes sense
 *    for the forum; private records (mutes, blocks) are only readable by
 *    their owner.
 *  - The `public.users` row is created automatically by a trigger on
 *    `auth.users` so the app does not have to maintain two sources of truth.
 */

------------------------------------------------------------------
-- Extensions
------------------------------------------------------------------
create extension if not exists "pgcrypto";

------------------------------------------------------------------
-- users
------------------------------------------------------------------
-- Mirrors auth.users. id matches auth.users.id so joins are cheap.
create table if not exists public.users (
  id             uuid primary key references auth.users(id) on delete cascade,
  username       text not null unique
                   check (char_length(username) between 3 and 32
                          and username ~ '^[A-Za-z0-9_\-]+$'),
  email          text not null unique, -- private, never displayed
  email_verified boolean not null default false,
  created_at     timestamptz not null default now(),
  last_active    timestamptz not null default now()
);

alter table public.users enable row level security;

-- Any authenticated user can read basic public user rows (for showing
-- usernames next to posts). Email is in the same row but the API should
-- avoid selecting it; a stricter view can be added in a later phase.
create policy "users: read for authenticated"
  on public.users for select
  to authenticated
  using (true);

create policy "users: update own row"
  on public.users for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "users: delete own row"
  on public.users for delete
  to authenticated
  using (auth.uid() = id);

-- Auto-provision a public.users row when a new auth user is created.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, username, email, email_verified)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)),
    new.email,
    new.email_confirmed_at is not null
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Keep email_verified in sync when the user confirms their email.
create or replace function public.handle_auth_user_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users
     set email_verified = new.email_confirmed_at is not null,
         email = new.email
   where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update on auth.users
  for each row execute function public.handle_auth_user_updated();

------------------------------------------------------------------
-- threads
------------------------------------------------------------------
create table if not exists public.threads (
  id         uuid primary key default gen_random_uuid(),
  category   text not null,
  title      text not null check (char_length(title) between 1 and 200),
  author_id  uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists threads_category_created_at_idx
  on public.threads (category, created_at desc);
create index if not exists threads_author_idx on public.threads (author_id);

alter table public.threads enable row level security;

create policy "threads: read all"
  on public.threads for select
  to authenticated, anon
  using (true);

create policy "threads: insert own"
  on public.threads for insert
  to authenticated
  with check (auth.uid() = author_id);

create policy "threads: update own"
  on public.threads for update
  to authenticated
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

create policy "threads: delete own"
  on public.threads for delete
  to authenticated
  using (auth.uid() = author_id);

------------------------------------------------------------------
-- posts
------------------------------------------------------------------
create table if not exists public.posts (
  id             uuid primary key default gen_random_uuid(),
  thread_id      uuid not null references public.threads(id) on delete cascade,
  parent_post_id uuid references public.posts(id) on delete cascade,
  author_id      uuid not null references public.users(id) on delete cascade,
  content        text not null check (char_length(content) between 1 and 20000),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists posts_thread_idx on public.posts (thread_id, created_at);
create index if not exists posts_parent_idx on public.posts (parent_post_id);
create index if not exists posts_author_idx on public.posts (author_id);

alter table public.posts enable row level security;

create policy "posts: read all"
  on public.posts for select
  to authenticated, anon
  using (true);

create policy "posts: insert own"
  on public.posts for insert
  to authenticated
  with check (auth.uid() = author_id);

create policy "posts: update own"
  on public.posts for update
  to authenticated
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

create policy "posts: delete own"
  on public.posts for delete
  to authenticated
  using (auth.uid() = author_id);

------------------------------------------------------------------
-- resources (the Library)
------------------------------------------------------------------
create table if not exists public.resources (
  id                 uuid primary key default gen_random_uuid(),
  category           text not null,
  title              text not null check (char_length(title) between 1 and 300),
  url                text not null,
  description        text not null check (char_length(description) between 1 and 2000),
  submitter_id       uuid not null references public.users(id) on delete cascade,
  created_at         timestamptz not null default now(),
  broken_flag_count  integer not null default 0
);

create index if not exists resources_category_created_at_idx
  on public.resources (category, created_at desc);
create index if not exists resources_submitter_idx on public.resources (submitter_id);

alter table public.resources enable row level security;

create policy "resources: read all"
  on public.resources for select
  to authenticated, anon
  using (true);

create policy "resources: insert own"
  on public.resources for insert
  to authenticated
  with check (auth.uid() = submitter_id);

create policy "resources: update own"
  on public.resources for update
  to authenticated
  using (auth.uid() = submitter_id)
  with check (auth.uid() = submitter_id);

create policy "resources: delete own"
  on public.resources for delete
  to authenticated
  using (auth.uid() = submitter_id);

------------------------------------------------------------------
-- ratings
------------------------------------------------------------------
create table if not exists public.ratings (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  content_type text not null check (content_type in ('post', 'resource')),
  content_id   uuid not null,
  rating       text not null check (rating in ('helpful', 'unhelpful')),
  created_at   timestamptz not null default now(),
  unique (user_id, content_type, content_id)
);

create index if not exists ratings_content_idx on public.ratings (content_type, content_id);

alter table public.ratings enable row level security;

create policy "ratings: read all"
  on public.ratings for select
  to authenticated, anon
  using (true);

create policy "ratings: insert own"
  on public.ratings for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "ratings: update own"
  on public.ratings for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "ratings: delete own"
  on public.ratings for delete
  to authenticated
  using (auth.uid() = user_id);

------------------------------------------------------------------
-- mutes (private)
------------------------------------------------------------------
create table if not exists public.mutes (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.users(id) on delete cascade,
  muted_user_id  uuid not null references public.users(id) on delete cascade,
  created_at     timestamptz not null default now(),
  unique (user_id, muted_user_id),
  check (user_id <> muted_user_id)
);

alter table public.mutes enable row level security;

create policy "mutes: owner only"
  on public.mutes for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

------------------------------------------------------------------
-- blocks (private)
------------------------------------------------------------------
create table if not exists public.blocks (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users(id) on delete cascade,
  blocked_user_id  uuid not null references public.users(id) on delete cascade,
  created_at       timestamptz not null default now(),
  unique (user_id, blocked_user_id),
  check (user_id <> blocked_user_id)
);

alter table public.blocks enable row level security;

create policy "blocks: owner only"
  on public.blocks for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

------------------------------------------------------------------
-- flags
------------------------------------------------------------------
create table if not exists public.flags (
  id           uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('post', 'resource', 'thread')),
  content_id   uuid not null,
  reason       text not null,
  auto_flagged boolean not null default false,
  reporter_id  uuid references public.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists flags_content_idx on public.flags (content_type, content_id);

alter table public.flags enable row level security;

-- Anyone signed in can file a flag; only the reporter can delete their own.
create policy "flags: insert own"
  on public.flags for insert
  to authenticated
  with check (reporter_id is null or auth.uid() = reporter_id);

create policy "flags: read own"
  on public.flags for select
  to authenticated
  using (reporter_id is not null and auth.uid() = reporter_id);

create policy "flags: delete own"
  on public.flags for delete
  to authenticated
  using (reporter_id is not null and auth.uid() = reporter_id);
