-- Phase 14: platform tag on library resources.
--
-- Adds a nullable text column to resources so that submissions in the
-- new "social-media-videos" library category can carry which platform
-- the video lives on (YouTube, TikTok, Instagram, etc.), and the
-- category page can group them by that instead of leaving everything
-- in one flat list.
--
-- Column stays nullable because every other library category ignores
-- it — the server action only writes a value when the category is
-- "social-media-videos" (see submitResourceAction).

alter table public.resources
  add column if not exists platform text;

create index if not exists resources_category_platform_idx
  on public.resources (category, platform, created_at desc);
