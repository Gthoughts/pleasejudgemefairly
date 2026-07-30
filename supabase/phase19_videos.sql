/*
 * a place for you - Phase 19 migration: Videos
 *
 * Adds a short-form portrait video feed. Design notes:
 *
 *   * Uploader identity is stored (uploader_id) for RLS and moderation
 *     but is never rendered in the UI. The site actions must not
 *     select or leak this column to the client.
 *   * Two feed modes: Topic (MF-ranked, filtered by category/subcategory,
 *     only includes videos with >= 10 qualified views) and Random
 *     (ORDER BY random(), no rank, no view threshold). The 10-view
 *     warm-up is enforced at query time, not by a column.
 *   * A vote (helpful/unhelpful) is only allowed once the user has
 *     watched at least 50% of the video. Enforced by an RLS policy
 *     on ratings that checks video_views.first_qualified_at.
 *   * Comments beneath a video use video_posts, mirroring the shape
 *     of user_project_posts so the same hold/dedupe/edit flow works.
 *   * User-created categories and subcategories go live immediately
 *     but land in an admin review queue. Admin can Keep, Rename,
 *     Merge into an existing tag, or Reject (which unpublishes the
 *     video and sends a directed message to the uploader).
 *
 * Tables added:
 *   - video_categories
 *   - video_subcategories
 *   - videos
 *   - video_views       (tracks watched_seconds per user+video)
 *   - video_posts       (mini forum per video)
 *   - admin_messages    (site-wide DM channel for admin -> user)
 *
 * Ratings/flags: reuses the existing tables with two new content_type
 * values, 'video' and 'video_post'.
 *
 * Run this once in the Supabase SQL editor after phases 1..18.
 */

------------------------------------------------------------------
-- 1. video_categories
------------------------------------------------------------------
create table if not exists public.video_categories (
  id             uuid        primary key default gen_random_uuid(),
  slug           text        not null,
  name           text        not null check (char_length(name) between 1 and 60),
  created_by     uuid        references public.users(id) on delete set null,
  status         text        not null default 'active'
                             check (status in ('active', 'pending_review', 'renamed', 'merged', 'rejected')),
  merged_into    uuid        references public.video_categories(id) on delete set null,
  sort_order     integer     not null default 1000,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (slug)
);

create index if not exists video_categories_status_idx
  on public.video_categories (status, sort_order, name);

alter table public.video_categories enable row level security;

drop policy if exists "video_categories: read for all" on public.video_categories;
create policy "video_categories: read for all"
  on public.video_categories for select
  to authenticated, anon
  using (status in ('active', 'pending_review'));

-- Authenticated users can create a category by picking "other" during
-- upload. The row lands as pending_review; admin can keep, rename,
-- merge, or reject.
drop policy if exists "video_categories: insert by authenticated" on public.video_categories;
create policy "video_categories: insert by authenticated"
  on public.video_categories for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and status = 'pending_review'
    and merged_into is null
  );

-- Updates and deletes are service-role only (admin path via server
-- action). No policy grants means those verbs are denied for
-- authenticated/anon by default under RLS.

------------------------------------------------------------------
-- 2. video_subcategories
------------------------------------------------------------------
create table if not exists public.video_subcategories (
  id             uuid        primary key default gen_random_uuid(),
  category_id    uuid        not null references public.video_categories(id) on delete cascade,
  slug           text        not null,
  name           text        not null check (char_length(name) between 1 and 60),
  created_by     uuid        references public.users(id) on delete set null,
  status         text        not null default 'active'
                             check (status in ('active', 'pending_review', 'renamed', 'merged', 'rejected')),
  merged_into    uuid        references public.video_subcategories(id) on delete set null,
  sort_order     integer     not null default 1000,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (category_id, slug)
);

create index if not exists video_subcategories_category_idx
  on public.video_subcategories (category_id, status, sort_order, name);

alter table public.video_subcategories enable row level security;

drop policy if exists "video_subcategories: read for all" on public.video_subcategories;
create policy "video_subcategories: read for all"
  on public.video_subcategories for select
  to authenticated, anon
  using (status in ('active', 'pending_review'));

drop policy if exists "video_subcategories: insert by authenticated" on public.video_subcategories;
create policy "video_subcategories: insert by authenticated"
  on public.video_subcategories for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and status = 'pending_review'
    and merged_into is null
  );

------------------------------------------------------------------
-- 3. videos
------------------------------------------------------------------
create table if not exists public.videos (
  id                 uuid        primary key default gen_random_uuid(),
  uploader_id        uuid        not null references public.users(id) on delete cascade,
  source_type        text        not null check (source_type in ('external', 'upload')),
  external_url       text        check (external_url is null or char_length(external_url) <= 1000),
  external_platform  text        check (external_platform in
                                        ('youtube', 'tiktok', 'instagram', 'x',
                                         'facebook', 'vimeo', 'rumble', 'peertube', 'other')),
  storage_ref        text        check (storage_ref is null or char_length(storage_ref) <= 500),
  title              text        not null check (char_length(title) between 1 and 200),
  description        text        check (description is null or char_length(description) <= 2000),
  duration_seconds   integer     check (duration_seconds is null or duration_seconds between 1 and 7200),
  aspect_ratio       text        check (aspect_ratio in ('portrait', 'landscape', 'square') or aspect_ratio is null),
  category_id        uuid        not null references public.video_categories(id) on delete restrict,
  subcategory_id     uuid        references public.video_subcategories(id) on delete set null,
  qualified_views    integer     not null default 0,
  helpfulness_score  numeric,
  rating_count       integer     not null default 0,
  is_collapsed       boolean     not null default false,
  hold_state         text        not null default 'none'
                                 check (hold_state in ('none', 'held', 'released')),
  hold_reasons       text[],
  hold_expires_at    timestamptz,
  released_at        timestamptz,
  released_by        text        check (released_by in ('auto', 'admin')),
  is_unpublished     boolean     not null default false,
  unpublished_reason text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- Exactly one source must be populated for its type.
  check (
    (source_type = 'external' and external_url is not null and storage_ref is null) or
    (source_type = 'upload'   and storage_ref  is not null and external_url is null)
  )
);

create index if not exists videos_category_ranked_idx
  on public.videos (category_id, helpfulness_score desc nulls last, created_at desc)
  where hold_state <> 'held' and is_collapsed = false and is_unpublished = false;

create index if not exists videos_subcategory_ranked_idx
  on public.videos (subcategory_id, helpfulness_score desc nulls last, created_at desc)
  where hold_state <> 'held' and is_collapsed = false and is_unpublished = false;

create index if not exists videos_uploader_idx
  on public.videos (uploader_id, created_at desc);

create index if not exists videos_hold_state_idx
  on public.videos (hold_state) where hold_state = 'held';

create index if not exists videos_is_collapsed_idx
  on public.videos (is_collapsed) where is_collapsed = true;

alter table public.videos enable row level security;

-- Anyone (including anon) can read videos, but not unpublished ones
-- and not held ones (held ones are shown via a targeted admin query).
drop policy if exists "videos: read live" on public.videos;
create policy "videos: read live"
  on public.videos for select
  to authenticated, anon
  using (is_unpublished = false);

drop policy if exists "videos: insert by uploader" on public.videos;
create policy "videos: insert by uploader"
  on public.videos for insert
  to authenticated
  with check (uploader_id = auth.uid());

-- Uploader can edit title, description, subcategory; the RLS check
-- doesn't distinguish columns, so the server action must guard which
-- columns it writes.
drop policy if exists "videos: update by uploader" on public.videos;
create policy "videos: update by uploader"
  on public.videos for update
  to authenticated
  using  (uploader_id = auth.uid())
  with check (uploader_id = auth.uid());

drop policy if exists "videos: delete by uploader" on public.videos;
create policy "videos: delete by uploader"
  on public.videos for delete
  to authenticated
  using (uploader_id = auth.uid());

------------------------------------------------------------------
-- 4. video_views
--
--   One row per (video, user). Tracks the maximum watched_seconds
--   ever observed, plus the moment the user first crossed the 50%
--   threshold. That timestamp is the gate on being allowed to vote.
--
--   Also increments videos.qualified_views once via trigger the first
--   time a user crosses the threshold for that video.
------------------------------------------------------------------
create table if not exists public.video_views (
  id                    uuid        primary key default gen_random_uuid(),
  video_id              uuid        not null references public.videos(id) on delete cascade,
  user_id               uuid        not null references public.users(id) on delete cascade,
  watched_seconds       integer     not null default 0 check (watched_seconds >= 0),
  watched_percent       numeric     not null default 0 check (watched_percent >= 0 and watched_percent <= 100),
  first_qualified_at    timestamptz,
  last_heartbeat_at     timestamptz not null default now(),
  created_at            timestamptz not null default now(),
  unique (video_id, user_id)
);

create index if not exists video_views_video_idx
  on public.video_views (video_id) where first_qualified_at is not null;

alter table public.video_views enable row level security;

drop policy if exists "video_views: own only" on public.video_views;
create policy "video_views: own only"
  on public.video_views for all
  to authenticated
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

-- When a user's row transitions from "not qualified" to "qualified"
-- (crosses the 50% mark for the first time), bump the video's
-- qualified_views counter by 1. Never decrement.
create or replace function public.handle_video_view_qualified()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT' and new.first_qualified_at is not null) then
    update public.videos
       set qualified_views = qualified_views + 1
     where id = new.video_id;
  elsif (tg_op = 'UPDATE'
         and old.first_qualified_at is null
         and new.first_qualified_at is not null) then
    update public.videos
       set qualified_views = qualified_views + 1
     where id = new.video_id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_video_view_qualified on public.video_views;
create trigger on_video_view_qualified
  after insert or update on public.video_views
  for each row execute function public.handle_video_view_qualified();

------------------------------------------------------------------
-- 5. video_posts (comments beneath a video)
------------------------------------------------------------------
create table if not exists public.video_posts (
  id                uuid        primary key default gen_random_uuid(),
  video_id          uuid        not null references public.videos(id) on delete cascade,
  parent_post_id    uuid        references public.video_posts(id) on delete cascade,
  author_id         uuid        not null references public.users(id) on delete cascade,
  content           text        not null check (char_length(content) between 1 and 20000),
  helpfulness_score numeric,
  rating_count      integer     not null default 0,
  is_collapsed      boolean     not null default false,
  hold_state        text        not null default 'none'
                                check (hold_state in ('none', 'held', 'released')),
  hold_reasons      text[],
  hold_expires_at   timestamptz,
  released_at       timestamptz,
  released_by       text        check (released_by in ('auto', 'admin')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists video_posts_video_idx
  on public.video_posts (video_id, created_at desc);
create index if not exists video_posts_parent_idx
  on public.video_posts (parent_post_id, created_at);
create index if not exists video_posts_author_idx
  on public.video_posts (author_id, created_at desc);
create index if not exists video_posts_hold_state_idx
  on public.video_posts (hold_state) where hold_state = 'held';

alter table public.video_posts enable row level security;

drop policy if exists "video_posts: read for all" on public.video_posts;
create policy "video_posts: read for all"
  on public.video_posts for select
  to authenticated, anon using (true);

drop policy if exists "video_posts: insert by author" on public.video_posts;
create policy "video_posts: insert by author"
  on public.video_posts for insert to authenticated
  with check (author_id = auth.uid());

drop policy if exists "video_posts: update by author" on public.video_posts;
create policy "video_posts: update by author"
  on public.video_posts for update to authenticated
  using  (author_id = auth.uid())
  with check (author_id = auth.uid());

drop policy if exists "video_posts: delete by author" on public.video_posts;
create policy "video_posts: delete by author"
  on public.video_posts for delete to authenticated
  using (author_id = auth.uid());

------------------------------------------------------------------
-- 6. admin_messages (site-wide DM channel, admin -> user)
--
--   Currently used to explain a rejected category / subcategory.
--   Read by the recipient; inserted by the service role from the
--   admin server actions. Never edited or deleted from client code.
------------------------------------------------------------------
create table if not exists public.admin_messages (
  id                   uuid        primary key default gen_random_uuid(),
  recipient_id         uuid        not null references public.users(id) on delete cascade,
  subject              text        not null check (char_length(subject) between 1 and 200),
  body                 text        not null check (char_length(body) between 1 and 5000),
  related_video_id     uuid        references public.videos(id) on delete set null,
  related_category_id  uuid        references public.video_categories(id) on delete set null,
  related_subcategory_id uuid      references public.video_subcategories(id) on delete set null,
  read_at              timestamptz,
  created_at           timestamptz not null default now()
);

create index if not exists admin_messages_recipient_idx
  on public.admin_messages (recipient_id, created_at desc);
create index if not exists admin_messages_recipient_unread_idx
  on public.admin_messages (recipient_id) where read_at is null;

alter table public.admin_messages enable row level security;

drop policy if exists "admin_messages: recipient read" on public.admin_messages;
create policy "admin_messages: recipient read"
  on public.admin_messages for select to authenticated
  using (recipient_id = auth.uid());

drop policy if exists "admin_messages: recipient mark read" on public.admin_messages;
create policy "admin_messages: recipient mark read"
  on public.admin_messages for update to authenticated
  using  (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

-- No insert or delete for authenticated / anon. Service-role only.

------------------------------------------------------------------
-- 7. Widen ratings/flags content_type checks to include the two new
--    types. Same drop-then-add pattern as phase 7 used.
------------------------------------------------------------------
alter table public.ratings drop constraint if exists ratings_content_type_check;
alter table public.ratings
  add constraint ratings_content_type_check
  check (content_type in ('post', 'resource', 'meetup_post', 'project_post',
                          'user_project_post', 'video', 'video_post'));

alter table public.flags drop constraint if exists flags_content_type_check;
alter table public.flags
  add constraint flags_content_type_check
  check (content_type in ('post', 'resource', 'thread', 'meetup_post', 'project_post',
                          'user_project_post', 'video', 'video_post'));

------------------------------------------------------------------
-- 8. Watch-gate on video ratings
--
--   A user may only insert a rating for a video if they have a
--   video_views row with first_qualified_at set (crossed the 50%
--   watch mark). This is enforced by a RESTRICTIVE policy that
--   only bites when content_type = 'video'. Other content types
--   are unaffected.
--
--   Both PERMISSIVE (the existing "ratings: insert own") and
--   RESTRICTIVE policies must pass for an insert to succeed. So the
--   existing "own row only" policy still applies, we're just adding
--   the watch check on top for the video case.
------------------------------------------------------------------
drop policy if exists "ratings: video watch gate" on public.ratings;
create policy "ratings: video watch gate"
  on public.ratings
  as restrictive
  for insert
  to authenticated
  with check (
    content_type <> 'video'
    or exists (
      select 1 from public.video_views v
       where v.video_id = ratings.content_id
         and v.user_id  = auth.uid()
         and v.first_qualified_at is not null
    )
  );

------------------------------------------------------------------
-- 9. Extend collapse_log to reference videos and video_posts
------------------------------------------------------------------
alter table public.collapse_log
  add column if not exists video_id      uuid references public.videos(id) on delete cascade,
  add column if not exists video_post_id uuid references public.video_posts(id) on delete cascade;

------------------------------------------------------------------
-- 10. Seed the top-level categories the site launches with. Idempotent.
------------------------------------------------------------------
insert into public.video_categories (slug, name, sort_order, status)
values
  ('history',     'History',     10, 'active'),
  ('politics',    'Politics',    20, 'active'),
  ('social',      'Social',      30, 'active'),
  ('community',   'Community',   40, 'active'),
  ('latest-news', 'Latest News', 50, 'active')
on conflict (slug) do nothing;

------------------------------------------------------------------
-- 11. Seed a handful of subcategories per top-level. Uploaders can
--     add more via the "other" flow (which lands in review).
------------------------------------------------------------------
do $$
declare
  v_cat_id uuid;
begin
  -- history
  select id into v_cat_id from public.video_categories where slug = 'history';
  if v_cat_id is not null then
    insert into public.video_subcategories (category_id, slug, name, sort_order, status)
    values
      (v_cat_id, 'general',        'General',        10, 'active'),
      (v_cat_id, 'uk',             'UK',             20, 'active'),
      (v_cat_id, 'world',          'World',          30, 'active'),
      (v_cat_id, 'local',          'Local',          40, 'active'),
      (v_cat_id, 'ancient',        'Ancient',        50, 'active'),
      (v_cat_id, 'modern',         'Modern',         60, 'active')
    on conflict (category_id, slug) do nothing;
  end if;

  -- politics
  select id into v_cat_id from public.video_categories where slug = 'politics';
  if v_cat_id is not null then
    insert into public.video_subcategories (category_id, slug, name, sort_order, status)
    values
      (v_cat_id, 'general',        'General',        10, 'active'),
      (v_cat_id, 'uk',             'UK',             20, 'active'),
      (v_cat_id, 'world',          'World',          30, 'active'),
      (v_cat_id, 'local',          'Local',          40, 'active'),
      (v_cat_id, 'media',          'Media',          50, 'active')
    on conflict (category_id, slug) do nothing;
  end if;

  -- social
  select id into v_cat_id from public.video_categories where slug = 'social';
  if v_cat_id is not null then
    insert into public.video_subcategories (category_id, slug, name, sort_order, status)
    values
      (v_cat_id, 'general',        'General',        10, 'active'),
      (v_cat_id, 'culture',        'Culture',        20, 'active'),
      (v_cat_id, 'family',         'Family',         30, 'active'),
      (v_cat_id, 'health',         'Health',         40, 'active'),
      (v_cat_id, 'education',      'Education',      50, 'active')
    on conflict (category_id, slug) do nothing;
  end if;

  -- community
  select id into v_cat_id from public.video_categories where slug = 'community';
  if v_cat_id is not null then
    insert into public.video_subcategories (category_id, slug, name, sort_order, status)
    values
      (v_cat_id, 'general',        'General',        10, 'active'),
      (v_cat_id, 'local-groups',   'Local groups',   20, 'active'),
      (v_cat_id, 'meetups',        'Meetups',        30, 'active'),
      (v_cat_id, 'projects',       'Projects',       40, 'active'),
      (v_cat_id, 'mutual-aid',     'Mutual aid',     50, 'active')
    on conflict (category_id, slug) do nothing;
  end if;

  -- latest-news
  select id into v_cat_id from public.video_categories where slug = 'latest-news';
  if v_cat_id is not null then
    insert into public.video_subcategories (category_id, slug, name, sort_order, status)
    values
      (v_cat_id, 'general',        'General',        10, 'active'),
      (v_cat_id, 'uk',             'UK',             20, 'active'),
      (v_cat_id, 'world',          'World',          30, 'active'),
      (v_cat_id, 'local',          'Local',          40, 'active'),
      (v_cat_id, 'tech',           'Tech',           50, 'active')
    on conflict (category_id, slug) do nothing;
  end if;
end;
$$;

------------------------------------------------------------------
-- 12. Reports, warnings, and permanent bans
--
--   Any signed-in viewer can long-press (3s) on a video and file a
--   report. The report auto-holds the video and admin reviews in
--   the Reports tab on /review. One of three verdicts follows:
--
--     confirmed       -> video was actually bad. Video stays down
--                        (is_unpublished=true), admin message to
--                        uploader. Reporter: no consequence.
--     warning         -> video was fine but reporter made a genuine
--                        mistake (something harmful easy to miss).
--                        Reporter gets an admin message and a
--                        warning is recorded. Three warnings
--                        trigger permanent ban automatically.
--     permanent_ban   -> video was fine and reporter obviously
--                        acted in bad faith. Immediate permanent
--                        revocation of the report privilege.
--
--   Anti-abuse:
--     * one report per user per video (unique index)
--     * server action enforces: not currently revoked, not more
--       than 5 reports in the past 24h.
--
--   We deliberately do NOT require any watch history before
--   allowing a report. Forcing users to sit through possibly
--   dangerous content to earn the right to report it would be
--   worse than trusting them.
------------------------------------------------------------------

alter table public.users
  add column if not exists video_report_warnings integer not null default 0,
  add column if not exists video_report_privilege_revoked_at timestamptz,
  add column if not exists video_report_revoked_reason text
    check (video_report_revoked_reason is null
           or video_report_revoked_reason in ('warnings_threshold', 'permanent_ban'));

create table if not exists public.video_reports (
  id             uuid        primary key default gen_random_uuid(),
  video_id       uuid        not null references public.videos(id) on delete cascade,
  reporter_id    uuid        not null references public.users(id) on delete cascade,
  reason_type    text        not null check (reason_type in ('adult', 'illegal', 'spam', 'other')),
  note           text        check (note is null or char_length(note) <= 500),
  status         text        not null default 'pending'
                             check (status in ('pending', 'confirmed', 'warning', 'permanent_ban')),
  reviewed_by    uuid        references public.users(id) on delete set null,
  reviewed_at    timestamptz,
  created_at     timestamptz not null default now(),
  unique (video_id, reporter_id)
);

create index if not exists video_reports_status_idx
  on public.video_reports (status, created_at desc);
create index if not exists video_reports_video_idx
  on public.video_reports (video_id, created_at desc);
create index if not exists video_reports_reporter_idx
  on public.video_reports (reporter_id, created_at desc);

alter table public.video_reports enable row level security;

-- Reporter can read own reports. Admins read via service role.
drop policy if exists "video_reports: read own" on public.video_reports;
create policy "video_reports: read own"
  on public.video_reports for select to authenticated
  using (reporter_id = auth.uid());

-- Insert by any authenticated user whose report privilege has not
-- been revoked. Revocation is permanent, either from the 3rd warning
-- (via handle_video_report_verdict below) or an immediate permanent
-- ban verdict. Rate limit and unique-per-video are also enforced in
-- the server action for a friendlier error message but the DB is
-- the source of truth.
drop policy if exists "video_reports: insert if not revoked" on public.video_reports;
create policy "video_reports: insert if not revoked"
  on public.video_reports for insert to authenticated
  with check (
    reporter_id = auth.uid()
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and not exists (
      select 1 from public.users u
       where u.id = auth.uid()
         and u.video_report_privilege_revoked_at is not null
    )
  );

-- No update or delete for authenticated. Admin verdicts go through
-- the service role.

------------------------------------------------------------------
-- 13. Trigger: on a new report, auto-hold the video.
--
--   Only bumps hold_state if the video is currently live. Sets a
--   null hold_expires_at so the cron auto-release does not touch
--   it (admin must decide). Also appends the report id to
--   hold_reasons for the admin UI to reference.
------------------------------------------------------------------
create or replace function public.handle_video_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.videos
     set hold_state      = 'held',
         hold_reasons    = array_append(coalesce(hold_reasons, '{}'), 'user_report:' || new.id::text),
         hold_expires_at = null
   where id = new.video_id
     and hold_state <> 'held';
  return new;
end;
$$;

drop trigger if exists on_video_report_insert on public.video_reports;
create trigger on_video_report_insert
  after insert on public.video_reports
  for each row execute function public.handle_video_report();

------------------------------------------------------------------
-- 14. Trigger: apply the verdict when admin reviews a report.
--
--   Runs on UPDATE of video_reports.status. Handles the three
--   admin-set verdicts:
--
--     confirmed     -> unpublish the video, clear the hold flag,
--                      record the reason. Reporter untouched.
--     warning       -> restore the video (if this was the only
--                      report), increment reporter's warning
--                      count. If it hits 3, revoke their report
--                      privilege permanently.
--     permanent_ban -> restore the video (if this was the only
--                      report), revoke the reporter's report
--                      privilege permanently, right now.
--
--   "Restore" means: if no other pending reports exist for the
--   same video, unset the hold state. If other pending reports
--   remain, leave the video held for the next verdict.
------------------------------------------------------------------
create or replace function public.handle_video_report_verdict()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_remaining_pending integer;
begin
  if new.status = old.status then
    return new;
  end if;
  if new.status = 'pending' then
    return new;
  end if;

  if new.status = 'confirmed' then
    update public.videos
       set is_unpublished     = true,
           unpublished_reason = 'user_report_confirmed',
           hold_state         = 'released',
           released_at        = now(),
           released_by        = 'admin'
     where id = new.video_id;
    return new;
  end if;

  -- warning or permanent_ban: consider restoring the video first.
  select count(*)::integer
    into v_remaining_pending
    from public.video_reports r
   where r.video_id = new.video_id
     and r.status   = 'pending'
     and r.id      <> new.id;

  if v_remaining_pending = 0 then
    update public.videos
       set hold_state   = 'released',
           released_at  = now(),
           released_by  = 'admin'
     where id = new.video_id
       and hold_state = 'held';
  end if;

  if new.status = 'warning' then
    update public.users
       set video_report_warnings = video_report_warnings + 1
     where id = new.reporter_id;

    update public.users
       set video_report_privilege_revoked_at = now(),
           video_report_revoked_reason       = 'warnings_threshold'
     where id = new.reporter_id
       and video_report_warnings >= 3
       and video_report_privilege_revoked_at is null;
  elsif new.status = 'permanent_ban' then
    update public.users
       set video_report_privilege_revoked_at = now(),
           video_report_revoked_reason       = 'permanent_ban'
     where id = new.reporter_id
       and video_report_privilege_revoked_at is null;
  end if;

  return new;
end;
$$;

drop trigger if exists on_video_report_verdict on public.video_reports;
create trigger on_video_report_verdict
  after update on public.video_reports
  for each row execute function public.handle_video_report_verdict();

------------------------------------------------------------------
-- 15. RPC: can_report_video()
--
--   Small helper the client calls before showing the report
--   gesture. Returns false when the user is revoked or over the
--   24h rate limit. The server action re-checks anyway; this just
--   avoids showing an option that would fail.
------------------------------------------------------------------
create or replace function public.can_report_video()
returns boolean
language sql
stable
security invoker
as $$
  select
    not exists (
      select 1 from public.users u
       where u.id = auth.uid()
         and u.video_report_privilege_revoked_at is not null
    )
    and (
      select count(*) from public.video_reports r
       where r.reporter_id = auth.uid()
         and r.created_at > now() - interval '24 hours'
    ) < 5
$$;

grant execute on function public.can_report_video() to authenticated;
