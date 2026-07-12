-- Phase 13: links on user projects.
--
-- Each user project can carry a small ordered list of external links
-- (website, docs, socials, etc.), stored as JSONB so we don't need a
-- second table. Each entry is `{ "label": string, "url": string }`.
-- Ordering is the array order. Validation and normalisation happen in
-- the createUserProjectAction / editUserProjectAction server actions.

alter table public.user_projects
  add column if not exists links jsonb not null default '[]'::jsonb;
