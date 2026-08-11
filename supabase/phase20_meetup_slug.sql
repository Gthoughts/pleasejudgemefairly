/*
 * a place for you - Phase 20 migration: meetup short-link slug
 *
 * Adds a short, human-readable slug to meetups so events can be shared
 * at wrenbrmn.org/m/<slug> instead of the UUID-based canonical URL.
 *
 *   * slug is unique, lowercase, [a-z0-9-] only, 3..40 chars.
 *   * Populated at creation from an organiser-supplied string or
 *     auto-derived from the title. Collisions get a numeric suffix
 *     (foo, foo-2, foo-3, ...) at the app layer.
 *   * The canonical URL /meetups/<id> is unchanged; /m/<slug> just
 *     looks up the id and redirects.
 *
 * Run this once in the Supabase SQL editor after phase 19.
 */

alter table public.meetups
  add column if not exists slug text;

------------------------------------------------------------------
-- Backfill existing rows.
--
-- For each meetup without a slug, build one from the title:
--   lowercase, strip non-alphanumerics to '-', collapse repeats,
--   trim leading/trailing '-', truncate to 40 chars. If empty
--   after stripping, fall back to the first 8 chars of the id.
-- Numeric suffixes disambiguate collisions.
------------------------------------------------------------------
do $$
declare
  m         record;
  base_slug text;
  candidate text;
  n         int;
begin
  for m in
    select id, title
    from   public.meetups
    where  slug is null
    order  by created_at asc
  loop
    base_slug := lower(m.title);
    base_slug := regexp_replace(base_slug, '[^a-z0-9]+', '-', 'g');
    base_slug := regexp_replace(base_slug, '(^-+|-+$)', '', 'g');
    base_slug := substring(base_slug from 1 for 40);
    base_slug := regexp_replace(base_slug, '-+$', '', 'g');

    if base_slug is null or char_length(base_slug) < 3 then
      base_slug := 'meetup-' || substring(m.id::text from 1 for 6);
    end if;

    candidate := base_slug;
    n := 1;
    while exists (select 1 from public.meetups where slug = candidate) loop
      n := n + 1;
      candidate := base_slug || '-' || n;
    end loop;

    update public.meetups set slug = candidate where id = m.id;
  end loop;
end $$;

------------------------------------------------------------------
-- Lock the column down now that every row has a slug.
------------------------------------------------------------------
alter table public.meetups
  alter column slug set not null;

alter table public.meetups
  add constraint meetups_slug_format
  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 40);

create unique index if not exists meetups_slug_key
  on public.meetups (slug);
