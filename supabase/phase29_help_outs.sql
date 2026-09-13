/*
 * a place for you - Phase 29 migration: Help Out (community help requests)
 *
 * A "Help Out" is a request for practical help (a fallen fence, an
 * overwhelming garage clear-out, a house move). A member posts what
 * needs doing, some photos, a GENERAL AREA (never a full address - the
 * site deliberately stores no home addresses; the requester shares the
 * exact address privately via messages), and one or more possible dates.
 * Other members volunteer for the date(s) they can do. Help can spread
 * across several days. The requester marks it "sorted" when they have
 * had enough help.
 *
 * Visible to signed-in members only.
 *
 * Three tables, mirroring the meetups + polls patterns already in use:
 *   help_outs             - the request itself
 *   help_out_dates        - the possible dates offered (like poll options)
 *   help_out_volunteers   - one row per (date, user) - who can do which day
 *
 * Photos live in a public 'help-out-photos' Storage bucket (created via
 * the API), referenced by public URL in help_outs.photo_urls.
 *
 * Run this once in the Supabase SQL editor after phase 28.
 */

------------------------------------------------------------------
-- 1. The help request
------------------------------------------------------------------
create table if not exists public.help_outs (
  id            uuid        primary key default gen_random_uuid(),
  -- who the help is FOR (usually the poster, but can be posted on
  -- someone's behalf); requester_id is who created/controls the request.
  requester_id  uuid        not null references public.users(id) on delete cascade,
  title         text        not null check (char_length(title) between 1 and 200),
  description   text        not null check (char_length(description) between 1 and 5000),
  -- General area only (town / district). NEVER a full address.
  area          text        not null check (char_length(area) between 1 and 120),
  -- Public image URLs (Supabase Storage, help-out-photos bucket).
  photo_urls    text[]      not null default '{}',
  status        text        not null default 'open'
                            check (status in ('open', 'sorted', 'cancelled')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.help_outs enable row level security;

-- Signed-in members can read all help requests.
create policy "help_outs: read for authenticated"
  on public.help_outs for select to authenticated using (true);

-- A member can create a request (they are the requester).
create policy "help_outs: insert own"
  on public.help_outs for insert to authenticated
  with check (auth.uid() = requester_id);

-- Only the requester can update (e.g. mark sorted) or delete their request.
create policy "help_outs: update own"
  on public.help_outs for update to authenticated
  using (auth.uid() = requester_id)
  with check (auth.uid() = requester_id);

create policy "help_outs: delete own"
  on public.help_outs for delete to authenticated
  using (auth.uid() = requester_id);

------------------------------------------------------------------
-- 2. Possible dates for a request
------------------------------------------------------------------
create table if not exists public.help_out_dates (
  id            uuid        primary key default gen_random_uuid(),
  help_out_id   uuid        not null references public.help_outs(id) on delete cascade,
  the_date      date        not null,
  display_order integer     not null default 0,
  created_at    timestamptz not null default now(),
  unique (help_out_id, the_date)
);

alter table public.help_out_dates enable row level security;

create policy "help_out_dates: read for authenticated"
  on public.help_out_dates for select to authenticated using (true);

-- Only the requester of the parent help_out may add/remove its dates.
create policy "help_out_dates: manage by requester"
  on public.help_out_dates for all to authenticated
  using (
    exists (
      select 1 from public.help_outs h
      where h.id = help_out_id and h.requester_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.help_outs h
      where h.id = help_out_id and h.requester_id = auth.uid()
    )
  );

------------------------------------------------------------------
-- 3. Volunteers: one row per (date, user)
------------------------------------------------------------------
create table if not exists public.help_out_volunteers (
  id            uuid        primary key default gen_random_uuid(),
  help_out_id   uuid        not null references public.help_outs(id) on delete cascade,
  date_id       uuid        not null references public.help_out_dates(id) on delete cascade,
  user_id       uuid        not null references public.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique (date_id, user_id)
);

alter table public.help_out_volunteers enable row level security;

-- Everyone signed in can see who has volunteered (so the requester and
-- others can see the help building up across days).
create policy "help_out_volunteers: read for authenticated"
  on public.help_out_volunteers for select to authenticated using (true);

-- A member can volunteer themselves (insert their own row).
create policy "help_out_volunteers: insert own"
  on public.help_out_volunteers for insert to authenticated
  with check (auth.uid() = user_id);

-- A member can withdraw their own offer.
create policy "help_out_volunteers: delete own"
  on public.help_out_volunteers for delete to authenticated
  using (auth.uid() = user_id);

------------------------------------------------------------------
-- 4. Keep updated_at fresh on help_outs
------------------------------------------------------------------
create or replace function public.touch_help_outs_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_help_outs_updated_at on public.help_outs;
create trigger trg_help_outs_updated_at
  before update on public.help_outs
  for each row execute function public.touch_help_outs_updated_at();

------------------------------------------------------------------
-- 5. Storage policies for the help-out-photos bucket
--    (bucket itself is created via the Storage API). Signed-in
--    members may upload; everyone may read; uploaders delete own.
------------------------------------------------------------------
create policy "help-out-photos: public read"
  on storage.objects for select
  using (bucket_id = 'help-out-photos');

create policy "help-out-photos: authenticated upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'help-out-photos');

create policy "help-out-photos: delete own"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'help-out-photos' and owner = auth.uid());
