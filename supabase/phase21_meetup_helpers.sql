/*
 * a place for you - Phase 21 migration: meetup co-organisers
 *
 * Adds two tables so users can offer to help run a meetup:
 *
 *   meetup_co_organisers
 *     Approved helpers. They get the same permissions as the lead
 *     organiser EXCEPT cancelling the meetup and managing the helper
 *     list itself. Those stay lead-organiser-only so one person keeps
 *     the veto.
 *
 *   meetup_organiser_requests
 *     Signed-in users click "Help organise this event" on a meetup
 *     page. That inserts a row here with status='pending'. The lead
 *     organiser (meetups.organiser_id) then approves or declines it.
 *
 * Both tables have a unique (meetup_id, user_id) so a user can't
 * request twice or be added twice.
 *
 * Run this once in the Supabase SQL editor after phase 20.
 */

------------------------------------------------------------------
-- meetup_co_organisers  (created first: the requests policy below
-- references this table).
------------------------------------------------------------------
create table if not exists public.meetup_co_organisers (
  meetup_id  uuid        not null references public.meetups(id) on delete cascade,
  user_id    uuid        not null references public.users(id) on delete cascade,
  added_at   timestamptz not null default now(),
  added_by   uuid        references public.users(id) on delete set null,
  primary key (meetup_id, user_id)
);

create index if not exists meetup_co_organisers_user_idx
  on public.meetup_co_organisers (user_id);

alter table public.meetup_co_organisers enable row level security;

create policy "co-organisers: read for authenticated"
  on public.meetup_co_organisers for select to authenticated using (true);

create policy "co-organisers: lead inserts"
  on public.meetup_co_organisers for insert to authenticated
  with check (exists (select 1 from public.meetups m where m.id = meetup_id and m.organiser_id = auth.uid()));

create policy "co-organisers: lead removes"
  on public.meetup_co_organisers for delete to authenticated
  using (exists (select 1 from public.meetups m where m.id = meetup_id and m.organiser_id = auth.uid()));

------------------------------------------------------------------
-- meetup_organiser_requests
------------------------------------------------------------------
create table if not exists public.meetup_organiser_requests (
  id            uuid        primary key default gen_random_uuid(),
  meetup_id     uuid        not null references public.meetups(id) on delete cascade,
  user_id       uuid        not null references public.users(id) on delete cascade,
  status        text        not null default 'pending'
                            check (status in ('pending', 'approved', 'declined')),
  requested_at  timestamptz not null default now(),
  decided_at    timestamptz,
  decided_by    uuid        references public.users(id) on delete set null,
  unique (meetup_id, user_id)
);

create index if not exists meetup_organiser_requests_meetup_idx
  on public.meetup_organiser_requests (meetup_id, status);

alter table public.meetup_organiser_requests enable row level security;

create policy "requests: read for authenticated"
  on public.meetup_organiser_requests for select to authenticated using (true);

create policy "requests: insert own"
  on public.meetup_organiser_requests for insert to authenticated
  with check (
    user_id = auth.uid()
    and not exists (
      select 1 from public.meetups m
      where m.id = meetup_id and m.organiser_id = auth.uid()
    )
    and not exists (
      select 1 from public.meetup_co_organisers c
      where c.meetup_id = meetup_organiser_requests.meetup_id
        and c.user_id = auth.uid()
    )
  );

create policy "requests: lead decides"
  on public.meetup_organiser_requests for update to authenticated
  using  (exists (select 1 from public.meetups m where m.id = meetup_id and m.organiser_id = auth.uid()))
  with check (exists (select 1 from public.meetups m where m.id = meetup_id and m.organiser_id = auth.uid()));

create policy "requests: requester or lead deletes"
  on public.meetup_organiser_requests for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.meetups m where m.id = meetup_id and m.organiser_id = auth.uid())
  );
