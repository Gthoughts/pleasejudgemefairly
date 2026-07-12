-- Phase 15: add "tech_for_good" alongside the existing user-project
-- categories. Business & Enterprise stays as it is.
--
-- Safe to run even if an earlier (destructive) draft of this file was
-- applied: the check constraint is dropped and re-added with the full
-- category list either way. It does not touch any existing rows, so
-- projects tagged 'business' or 'tech_for_good' both keep their tag.

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
    'business',
    'tech_for_good',
    'other'
  ));
