/*
 * a place for you - Phase 24 migration: meetup polls / voting
 *
 * Lets organisers seed multiple-choice polls when creating a meetup
 * (dates, locations or custom questions) and members vote on them.
 * Voting is MULTIPLE CHOICE: a member may tick several options per
 * poll, and each tick is a single toggle-able vote.
 *
 *   meetup_polls
 *     One poll per row. Title + poll_type ('date' | 'location' |
 *     'custom'). Managed (created/edited/removed) by the lead
 *     organiser OR an approved co-organiser of the meetup.
 *
 *   meetup_poll_options
 *     The choices for a poll. Managed by the same organiser /
 *     co-organiser set as the parent poll's meetup.
 *
 *   meetup_poll_votes
 *     One row per (option, user). A unique (option_id, user_id)
 *     keeps a user from voting twice for the same option. poll_id is
 *     denormalised so counts can be aggregated without a join.
 *
 * Run this once in the Supabase SQL editor after phase 23.
 */

------------------------------------------------------------------
-- meetup_polls
------------------------------------------------------------------
create table if not exists public.meetup_polls (
  id            uuid        primary key default gen_random_uuid(),
  meetup_id     uuid        not null references public.meetups(id) on delete cascade,
  title         text        not null check (char_length(title) between 1 and 200),
  poll_type     text        not null default 'custom'
                            check (poll_type in ('date', 'location', 'custom')),
  display_order integer     not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists meetup_polls_meetup_idx
  on public.meetup_polls (meetup_id);

alter table public.meetup_polls enable row level security;

create policy "meetup_polls: read for authenticated"
  on public.meetup_polls for select to authenticated using (true);

-- Managed by the lead organiser OR an approved co-organiser.
create policy "meetup_polls: manage by organiser or co-organiser"
  on public.meetup_polls for all to authenticated
  using (
    exists (
      select 1 from public.meetups m
      where m.id = meetup_id and m.organiser_id = auth.uid()
    )
    or exists (
      select 1 from public.meetup_co_organisers c
      where c.meetup_id = meetup_polls.meetup_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.meetups m
      where m.id = meetup_id and m.organiser_id = auth.uid()
    )
    or exists (
      select 1 from public.meetup_co_organisers c
      where c.meetup_id = meetup_polls.meetup_id and c.user_id = auth.uid()
    )
  );

------------------------------------------------------------------
-- meetup_poll_options
------------------------------------------------------------------
create table if not exists public.meetup_poll_options (
  id            uuid        primary key default gen_random_uuid(),
  poll_id       uuid        not null references public.meetup_polls(id) on delete cascade,
  label         text        not null check (char_length(label) between 1 and 200),
  display_order integer     not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists meetup_poll_options_poll_idx
  on public.meetup_poll_options (poll_id);

alter table public.meetup_poll_options enable row level security;

create policy "meetup_poll_options: read for authenticated"
  on public.meetup_poll_options for select to authenticated using (true);

-- Managed by the organiser / co-organiser of the parent poll's meetup.
create policy "meetup_poll_options: manage by organiser or co-organiser"
  on public.meetup_poll_options for all to authenticated
  using (
    exists (
      select 1
      from   public.meetup_polls p
      join   public.meetups m on m.id = p.meetup_id
      where  p.id = poll_id and m.organiser_id = auth.uid()
    )
    or exists (
      select 1
      from   public.meetup_polls p
      join   public.meetup_co_organisers c on c.meetup_id = p.meetup_id
      where  p.id = poll_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from   public.meetup_polls p
      join   public.meetups m on m.id = p.meetup_id
      where  p.id = poll_id and m.organiser_id = auth.uid()
    )
    or exists (
      select 1
      from   public.meetup_polls p
      join   public.meetup_co_organisers c on c.meetup_id = p.meetup_id
      where  p.id = poll_id and c.user_id = auth.uid()
    )
  );

------------------------------------------------------------------
-- meetup_poll_votes
------------------------------------------------------------------
create table if not exists public.meetup_poll_votes (
  id         uuid        primary key default gen_random_uuid(),
  option_id  uuid        not null references public.meetup_poll_options(id) on delete cascade,
  poll_id    uuid        not null references public.meetup_polls(id) on delete cascade,
  user_id    uuid        not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (option_id, user_id)
);

create index if not exists meetup_poll_votes_poll_idx
  on public.meetup_poll_votes (poll_id);

create index if not exists meetup_poll_votes_option_idx
  on public.meetup_poll_votes (option_id);

alter table public.meetup_poll_votes enable row level security;

create policy "meetup_poll_votes: read for authenticated"
  on public.meetup_poll_votes for select to authenticated using (true);

create policy "meetup_poll_votes: insert own"
  on public.meetup_poll_votes for insert to authenticated
  with check (user_id = auth.uid());

create policy "meetup_poll_votes: delete own"
  on public.meetup_poll_votes for delete to authenticated
  using (user_id = auth.uid());
