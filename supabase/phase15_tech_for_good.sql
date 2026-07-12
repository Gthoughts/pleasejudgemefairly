-- Phase 15: rename the "business" user-project category to "tech_for_good".
--
-- Any user_projects rows still tagged as 'business' are migrated over
-- to 'tech_for_good' before the check constraint is swapped so the
-- constraint change never fails on existing data.

update public.user_projects
  set category = 'tech_for_good'
  where category = 'business';

alter table public.user_projects
  drop constraint if exists user_projects_category_check;

alter table public.user_projects
  add constraint user_projects_category_check
  check (category in (
    'community',
    'arts',
    'housing',
    'skills',
    'environment',
    'health',
    'justice',
    'tech_for_good',
    'other'
  ));
