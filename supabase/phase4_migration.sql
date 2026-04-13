/*
 * pleasejudgemefairly - Phase 4 migration
 *
 * Run this once in the Supabase SQL editor after phases 1-3 are in place.
 *
 * Adds:
 *   1. Rating and hold columns to `resources` (mirrors what phase 3 did for posts)
 *   2. `broken_confirmed` column for admin broken-link confirmation
 *   3. `resource_id` column on `collapse_log` for resource audit events
 *   4. Trigger to maintain `broken_flag_count` automatically
 *   5. Unique partial index to prevent duplicate broken-link flags
 *   6. Seed entry: "What If We Are Wrong About Everything" book
 */

------------------------------------------------------------------
-- 1. Extend `resources` with rating and hold columns
------------------------------------------------------------------
alter table public.resources
  add column if not exists helpfulness_score  numeric,
  add column if not exists rating_count        integer     not null default 0,
  add column if not exists is_collapsed        boolean     not null default false,
  add column if not exists hold_state          text        not null default 'none'
                              check (hold_state in ('none', 'held', 'released')),
  add column if not exists hold_reasons        text[],
  add column if not exists hold_expires_at     timestamptz,
  add column if not exists released_at         timestamptz,
  add column if not exists released_by         text
                              check (released_by in ('auto', 'admin')),
  add column if not exists broken_confirmed    boolean;

create index if not exists resources_hold_state_idx
  on public.resources (hold_state)
  where hold_state = 'held';

create index if not exists resources_is_collapsed_idx
  on public.resources (is_collapsed)
  where is_collapsed = true;

------------------------------------------------------------------
-- 2. Extend collapse_log to also reference resources
------------------------------------------------------------------
alter table public.collapse_log
  add column if not exists resource_id uuid references public.resources(id) on delete cascade;

------------------------------------------------------------------
-- 3. Trigger: auto-increment broken_flag_count when a broken_link
--    flag is inserted for a resource.
------------------------------------------------------------------
create or replace function public.handle_broken_link_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.content_type = 'resource' and new.reason = 'broken_link' then
    update public.resources
       set broken_flag_count = broken_flag_count + 1
     where id = new.content_id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_broken_link_flag_inserted on public.flags;
create trigger on_broken_link_flag_inserted
  after insert on public.flags
  for each row execute function public.handle_broken_link_flag();

------------------------------------------------------------------
-- 4. Unique partial index: one broken-link flag per user per resource
------------------------------------------------------------------
create unique index if not exists flags_broken_link_unique_idx
  on public.flags (content_type, content_id, reporter_id)
  where reason = 'broken_link' and reporter_id is not null;

------------------------------------------------------------------
-- 5. Seed: "What If We Are Wrong About Everything" book entry
--    Only inserts if the admin user exists and no duplicate exists.
------------------------------------------------------------------
do $$
declare
  v_admin_id uuid;
begin
  select id into v_admin_id
    from public.users
   where email = 'gthoughts_gwords_gactons@proton.me'
   limit 1;

  if v_admin_id is not null then
    insert into public.resources (category, title, url, description, submitter_id)
    select
      'books',
      'What If We Are Wrong About Everything',
      'https://placeholder.invalid/what-if-we-are-wrong-about-everything',
      'Seed entry - update the URL once known.',
      v_admin_id
    where not exists (
      select 1 from public.resources
       where title = 'What If We Are Wrong About Everything'
    );
  end if;
end;
$$;
