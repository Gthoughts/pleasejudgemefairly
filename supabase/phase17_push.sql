-- Phase 17: silent push subscriptions for the home-screen icon badge.
--
-- Stores every browser's Web Push subscription (the endpoint URL and
-- the p256dh/auth keys the browser generated during subscribe) so the
-- server can send a silent push when a reply arrives. The service
-- worker receives the push and updates the PWA icon's badge via the
-- Badging API — no notification banner, no sound, just a red dot with
-- the unread count.
--
-- One user can be subscribed on multiple devices; each row is a
-- (user_id, endpoint) pair. Endpoints are globally unique in
-- practice, so we key by endpoint at the DB level as well.

create table if not exists public.push_subscriptions (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references public.users(id) on delete cascade,
  endpoint    text        not null unique,
  p256dh      text        not null,
  auth        text        not null,
  user_agent  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- A user manages their own subscriptions from the browser; nobody
-- else needs to read them. Server-side sends go through the service
-- role, which bypasses RLS.
drop policy if exists "push_subscriptions: read own" on public.push_subscriptions;
create policy "push_subscriptions: read own"
  on public.push_subscriptions for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "push_subscriptions: insert own" on public.push_subscriptions;
create policy "push_subscriptions: insert own"
  on public.push_subscriptions for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "push_subscriptions: update own" on public.push_subscriptions;
create policy "push_subscriptions: update own"
  on public.push_subscriptions for update to authenticated
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "push_subscriptions: delete own" on public.push_subscriptions;
create policy "push_subscriptions: delete own"
  on public.push_subscriptions for delete to authenticated
  using (user_id = auth.uid());


-- Inbox unread count for a specific user id. Callable by the server
-- with the service role to figure out what number to put on a
-- recipient's badge without impersonating them. Mirrors the logic in
-- inbox_unread_count() from phase10 exactly, just parameterised.

create or replace function public.inbox_unread_count_for(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.posts p
  where p.parent_post_id in (
    select id from public.posts where author_id = p_user_id
  )
  and p.author_id <> p_user_id
  and p.author_id not in (
    select muted_user_id from public.mutes where user_id = p_user_id
  )
  and p.created_at > coalesce(
    (select inbox_last_seen_at from public.users where id = p_user_id),
    'epoch'::timestamptz
  )
$$;

-- Only the service role needs to call this; do not grant to
-- authenticated users (they should use inbox_unread_count()).
revoke all on function public.inbox_unread_count_for(uuid) from public;
revoke all on function public.inbox_unread_count_for(uuid) from authenticated;
grant execute on function public.inbox_unread_count_for(uuid) to service_role;
