/*
 * pleasejudgemefairly - Phase 2 migration
 *
 * Run this once in the Supabase SQL editor after you have already applied
 * supabase/schema.sql. It adds:
 *   1. A replacement `posts` INSERT policy that also prevents a blocked
 *      user from replying to the blocker's thread.
 *   2. An `is_blocked_by(target uuid)` helper function so the UI can check
 *      "has the thread author blocked me?" without needing SELECT access to
 *      other users' blocks rows.
 */

------------------------------------------------------------------
-- 1. Replace posts insert policy to enforce block-prevention
------------------------------------------------------------------
drop policy if exists "posts: insert own" on public.posts;
drop policy if exists "posts: insert own and not blocked by thread author" on public.posts;

create policy "posts: insert own and not blocked by thread author"
  on public.posts for insert
  to authenticated
  with check (
    auth.uid() = author_id
    and not exists (
      select 1
      from public.threads t
      join public.blocks b on b.user_id = t.author_id
      where t.id = posts.thread_id
        and b.blocked_user_id = auth.uid()
    )
  );

------------------------------------------------------------------
-- 2. is_blocked_by helper
------------------------------------------------------------------
create or replace function public.is_blocked_by(target uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocks
    where user_id = target
      and blocked_user_id = auth.uid()
  );
$$;

grant execute on function public.is_blocked_by(uuid) to authenticated;
