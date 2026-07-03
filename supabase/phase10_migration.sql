-- Phase 10: unobtrusive inbox notifications.
--
-- Adds a per-user "last time you looked at your inbox" timestamp on
-- public.users and an RPC that returns the count of replies to your
-- posts that arrived since you last looked (excluding your own
-- replies and anyone you have muted). The SectionHeader on
-- Discuss / Library / Meetups / Projects renders "(N)" next to the
-- Inbox link when this is > 0. Visiting /inbox resets the timestamp
-- back to now(), so the count returns to 0 until the next reply.
--
-- No emails, no push, no realtime — the site's stated design forbids
-- push notifications. This is a pull-side "there is something new"
-- indicator only.

--------------------------------------------------------------------
-- 1. users.inbox_last_seen_at
--------------------------------------------------------------------

alter table public.users
  add column if not exists inbox_last_seen_at timestamptz;

--------------------------------------------------------------------
-- 2. inbox_unread_count() RPC
--
--    security invoker so RLS on posts/mutes still applies — this
--    function is not doing anything a signed-in user could not do
--    themselves via three separate queries, it just does it in one.
--------------------------------------------------------------------

create or replace function public.inbox_unread_count()
returns integer
language sql
stable
security invoker
as $$
  select count(*)::integer
  from public.posts p
  where p.parent_post_id in (
    select id from public.posts where author_id = auth.uid()
  )
  and p.author_id <> auth.uid()
  and p.author_id not in (
    select muted_user_id from public.mutes where user_id = auth.uid()
  )
  and p.created_at > coalesce(
    (select inbox_last_seen_at from public.users where id = auth.uid()),
    'epoch'::timestamptz
  )
$$;

grant execute on function public.inbox_unread_count() to authenticated;
