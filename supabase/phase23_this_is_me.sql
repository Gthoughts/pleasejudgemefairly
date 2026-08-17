/*
 * a place for you - Phase 23 migration: "This is me" personal stories
 *
 * A signed-in-only section where each user gets a growing story page.
 * Entries are text / photo / video, listed oldest-first (a journey
 * unfolds top to bottom). Others can love an entry (no visible count,
 * just a pulse). Comments are off by default per entry - the poster
 * toggles them on when explicitly asking for feedback.
 *
 * Landing page (/thisisme) lists every user who has at least one entry
 * with a Random / Latest / Oldest toggle and a search box. Individual
 * stories live at /thisisme/<username>.
 *
 * Run this once in the Supabase SQL editor after phase 22.
 */

------------------------------------------------------------------
-- 1. Story entries
------------------------------------------------------------------
create table if not exists public.this_is_me_entries (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references public.users(id) on delete cascade,
  entry_type        text        not null check (entry_type in ('text', 'photo', 'video')),
  content           text        check (content is null or char_length(content) between 0 and 20000),
  media_url         text        check (media_url is null or char_length(media_url) <= 2000),
  comments_enabled  boolean     not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists this_is_me_entries_user_idx
  on public.this_is_me_entries (user_id, created_at asc);

alter table public.this_is_me_entries enable row level security;

create policy "this_is_me_entries: read for authenticated"
  on public.this_is_me_entries for select to authenticated using (true);

create policy "this_is_me_entries: insert own"
  on public.this_is_me_entries for insert to authenticated
  with check (user_id = auth.uid());

create policy "this_is_me_entries: update own"
  on public.this_is_me_entries for update to authenticated
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "this_is_me_entries: delete own"
  on public.this_is_me_entries for delete to authenticated
  using (user_id = auth.uid());

------------------------------------------------------------------
-- 2. Loves
--
-- Unique (entry_id, user_id) so one love per user per entry. Reads
-- and writes are open to any signed-in user; no counts are ever
-- rendered anywhere - the love just pulses on the poster's inbox.
------------------------------------------------------------------
create table if not exists public.this_is_me_loves (
  entry_id    uuid        not null references public.this_is_me_entries(id) on delete cascade,
  user_id     uuid        not null references public.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (entry_id, user_id)
);

create index if not exists this_is_me_loves_entry_idx
  on public.this_is_me_loves (entry_id);

alter table public.this_is_me_loves enable row level security;

create policy "this_is_me_loves: read for authenticated"
  on public.this_is_me_loves for select to authenticated using (true);

create policy "this_is_me_loves: insert own"
  on public.this_is_me_loves for insert to authenticated
  with check (user_id = auth.uid());

create policy "this_is_me_loves: delete own"
  on public.this_is_me_loves for delete to authenticated
  using (user_id = auth.uid());

------------------------------------------------------------------
-- 3. Comments
--
-- Only insertable on entries with comments_enabled = true. Poster
-- can always add their own regardless of the toggle (own-post
-- follow-ups). Enforced via RLS.
------------------------------------------------------------------
create table if not exists public.this_is_me_comments (
  id          uuid        primary key default gen_random_uuid(),
  entry_id    uuid        not null references public.this_is_me_entries(id) on delete cascade,
  author_id   uuid        not null references public.users(id) on delete cascade,
  content     text        not null check (char_length(content) between 1 and 10000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists this_is_me_comments_entry_idx
  on public.this_is_me_comments (entry_id, created_at asc);

alter table public.this_is_me_comments enable row level security;

create policy "this_is_me_comments: read for authenticated"
  on public.this_is_me_comments for select to authenticated using (true);

create policy "this_is_me_comments: insert when enabled or own entry"
  on public.this_is_me_comments for insert to authenticated
  with check (
    author_id = auth.uid()
    and (
      exists (
        select 1 from public.this_is_me_entries e
        where e.id = entry_id
          and (e.comments_enabled = true or e.user_id = auth.uid())
      )
    )
  );

create policy "this_is_me_comments: delete own"
  on public.this_is_me_comments for delete to authenticated
  using (author_id = auth.uid());

------------------------------------------------------------------
-- 4. Storage bucket for photos
------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('this-is-me-photos', 'this-is-me-photos', true)
on conflict (id) do nothing;

-- Anyone signed in can read (bucket is public but keep RLS explicit).
create policy "this-is-me-photos: public read"
  on storage.objects for select to public
  using (bucket_id = 'this-is-me-photos');

-- Uploads go to <user_id>/<filename>. Users can only write into
-- their own folder.
create policy "this-is-me-photos: upload to own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'this-is-me-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "this-is-me-photos: delete own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'this-is-me-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

------------------------------------------------------------------
-- 5. Extend inbox_unread_count() so the badge also counts loves and
--    comments on the current user's this_is_me entries since they
--    last visited /inbox.
------------------------------------------------------------------
create or replace function public.inbox_unread_count()
returns integer
language sql
stable
security invoker
as $$
  with last_seen as (
    select coalesce(inbox_last_seen_at, 'epoch'::timestamptz) as ts
    from   public.users
    where  id = auth.uid()
  )
  select
    -- Replies to the current user's discuss posts (unchanged behaviour).
    (
      select count(*)::integer
      from   public.posts p
      where  p.parent_post_id in (
               select id from public.posts where author_id = auth.uid()
             )
        and  p.author_id <> auth.uid()
        and  p.author_id not in (
               select muted_user_id from public.mutes where user_id = auth.uid()
             )
        and  p.created_at > (select ts from last_seen)
    )
    +
    -- Loves on the current user's this_is_me entries.
    (
      select count(*)::integer
      from   public.this_is_me_loves l
      join   public.this_is_me_entries e on e.id = l.entry_id
      where  e.user_id = auth.uid()
        and  l.user_id <> auth.uid()
        and  l.created_at > (select ts from last_seen)
    )
    +
    -- Comments on the current user's this_is_me entries.
    (
      select count(*)::integer
      from   public.this_is_me_comments c
      join   public.this_is_me_entries e on e.id = c.entry_id
      where  e.user_id = auth.uid()
        and  c.author_id <> auth.uid()
        and  c.created_at > (select ts from last_seen)
    )
$$;
