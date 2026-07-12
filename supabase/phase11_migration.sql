-- Phase 11: private threads.
--
-- Any participant in a thread (the author plus anyone who has replied)
-- can make the conversation private once at least two people are in it.
-- While private:
--   * the thread disappears from listings for everyone else
--   * only participants can read it or reply
--   * every post written while private records a snapshot of who was in
--     the conversation at that moment (posts.visible_to)
-- A participant can flip the thread back to public at any time, but the
-- posts written during the private period keep their snapshot and remain
-- visible ONLY to the people who were in the conversation when it was
-- private. New posts after that are public again.
--
-- Enforcement is entirely in the database (columns + triggers + RLS),
-- so no client or API path can leak private content.

--------------------------------------------------------------------
-- 1. Columns
--------------------------------------------------------------------

alter table public.threads
  add column if not exists is_private boolean not null default false;

-- null = public post. Non-null = only these user ids may read it.
alter table public.posts
  add column if not exists visible_to uuid[];

--------------------------------------------------------------------
-- 2. Participants ("who is in the conversation")
--------------------------------------------------------------------

create table if not exists public.thread_participants (
  thread_id  uuid not null references public.threads(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

create index if not exists thread_participants_user_idx
  on public.thread_participants (user_id);

alter table public.thread_participants enable row level security;

--------------------------------------------------------------------
-- 3. Helper functions
--
-- security definer so RLS policies can consult threads /
-- thread_participants without recursing into their own policies.
-- Both only ever answer for auth.uid(), so they cannot be used to
-- probe other people's membership of private threads.
--------------------------------------------------------------------

create or replace function public.is_thread_participant(t_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.thread_participants
    where thread_id = t_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_thread_private(t_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select is_private from public.threads where id = t_id),
    false
  );
$$;

-- Participants of a thread can see who else is in it; for public
-- threads the list is readable by any signed-in user (it is derivable
-- from the posts anyway). No insert/update/delete policies: rows are
-- only written by the security definer triggers below.
drop policy if exists "thread_participants: read" on public.thread_participants;
create policy "thread_participants: read"
  on public.thread_participants for select
  to authenticated
  using (
    public.is_thread_participant(thread_id)
    or not public.is_thread_private(thread_id)
  );

--------------------------------------------------------------------
-- 4. Triggers
--------------------------------------------------------------------

-- Thread author becomes a participant immediately.
create or replace function public.handle_thread_created()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.thread_participants (thread_id, user_id)
  values (new.id, new.author_id)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_thread_created_add_participant on public.threads;
create trigger on_thread_created_add_participant
  after insert on public.threads
  for each row execute function public.handle_thread_created();

-- Before a post is stored: if the thread is currently private, stamp it
-- with the participant snapshot; otherwise force visible_to to null so
-- a client can never forge post visibility.
create or replace function public.handle_post_set_visibility()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if (select is_private from public.threads where id = new.thread_id) then
    new.visible_to := (
      select array_agg(user_id)
      from public.thread_participants
      where thread_id = new.thread_id
    );
  else
    new.visible_to := null;
  end if;
  return new;
end;
$$;

drop trigger if exists on_post_insert_set_visibility on public.posts;
create trigger on_post_insert_set_visibility
  before insert on public.posts
  for each row execute function public.handle_post_set_visibility();

-- After a post is stored, its author joins the conversation.
create or replace function public.handle_post_created_add_participant()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.thread_participants (thread_id, user_id)
  values (new.thread_id, new.author_id)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_post_created_add_participant on public.posts;
create trigger on_post_created_add_participant
  after insert on public.posts
  for each row execute function public.handle_post_created_add_participant();

--------------------------------------------------------------------
-- 5. Backfill participants for existing threads
--------------------------------------------------------------------

insert into public.thread_participants (thread_id, user_id)
select id, author_id from public.threads
on conflict do nothing;

insert into public.thread_participants (thread_id, user_id)
select distinct thread_id, author_id from public.posts
on conflict do nothing;

--------------------------------------------------------------------
-- 6. RLS
--
-- RESTRICTIVE policies AND with the existing permissive ones
-- ("threads: read all", "posts: read all", phase 2's block-aware
-- insert policy), so nothing already enforced is weakened.
--------------------------------------------------------------------

drop policy if exists "threads: private participants only" on public.threads;
create policy "threads: private participants only"
  on public.threads as restrictive for select
  to authenticated, anon
  using (not is_private or public.is_thread_participant(id));

drop policy if exists "posts: private participants only" on public.posts;
create policy "posts: private participants only"
  on public.posts as restrictive for select
  to authenticated, anon
  using (
    (visible_to is null or auth.uid() = any (visible_to))
    and (
      not public.is_thread_private(thread_id)
      or public.is_thread_participant(thread_id)
    )
  );

drop policy if exists "posts: only participants reply while private" on public.posts;
create policy "posts: only participants reply while private"
  on public.posts as restrictive for insert
  to authenticated
  with check (
    not public.is_thread_private(thread_id)
    or public.is_thread_participant(thread_id)
  );

--------------------------------------------------------------------
-- 7. Toggle RPC
--
-- security definer because RLS only lets the thread author update the
-- threads row, but privacy may be changed by ANY participant. The
-- checks below are the entire authorisation story for this function.
--------------------------------------------------------------------

create or replace function public.set_thread_privacy(
  p_thread_id uuid,
  p_private boolean
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  n_participants integer;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;

  if not exists (
    select 1 from public.thread_participants
    where thread_id = p_thread_id and user_id = auth.uid()
  ) then
    raise exception 'Only people in this conversation can change its privacy.';
  end if;

  if p_private then
    select count(*) into n_participants
    from public.thread_participants
    where thread_id = p_thread_id;

    if n_participants < 2 then
      raise exception 'A conversation can only be made private once at least two people are in it.';
    end if;
  end if;

  update public.threads
  set is_private = p_private
  where id = p_thread_id;
end;
$$;

revoke execute on function public.set_thread_privacy(uuid, boolean) from anon;
