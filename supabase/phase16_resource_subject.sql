-- Phase 16: topic / subject tag on library resources.
--
-- Lets a submitter pick a topic (History, Politics & Society, Justice,
-- etc.) for every resource regardless of format. The category slug
-- (books, articles-and-essays, ...) still says WHAT format the
-- resource is; the subject slug says WHAT IT'S ABOUT so browsing by
-- theme across formats becomes possible.
--
-- Column is nullable so existing rows keep working; new submissions
-- validate the value in submitResourceAction. Existing rows show up
-- as "Uncategorised" until an admin or the submitter re-tags them.

alter table public.resources
  add column if not exists subject text;

create index if not exists resources_subject_created_at_idx
  on public.resources (subject, created_at desc);
