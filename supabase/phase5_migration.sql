-- ============================================================
-- Phase 5: Meetups
-- Run against: production Supabase project
-- ============================================================

-- meetups -------------------------------------------------------
create table public.meetups (
  id            uuid        primary key default gen_random_uuid(),
  title         text        not null check (char_length(title) between 1 and 200),
  description   text        not null check (char_length(description) between 1 and 5000),
  date_time     timestamptz not null,
  location      text        not null check (char_length(location) between 1 and 200),
  is_online     boolean     not null default false,
  organiser_id  uuid        not null references public.users(id) on delete cascade,
  max_attendees integer     check (max_attendees > 0),
  status        text        not null default 'active'
                            check (status in ('active', 'cancelled')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.meetups enable row level security;

create policy "meetups: read for authenticated"
  on public.meetups for select to authenticated using (true);

create policy "meetups: insert own"
  on public.meetups for insert to authenticated
  with check (organiser_id = auth.uid());

create policy "meetups: update own"
  on public.meetups for update to authenticated
  using  (organiser_id = auth.uid())
  with check (organiser_id = auth.uid());

create policy "meetups: delete own"
  on public.meetups for delete to authenticated
  using (organiser_id = auth.uid());

-- meetup_questions -----------------------------------------------
create table public.meetup_questions (
  id            uuid    primary key default gen_random_uuid(),
  meetup_id     uuid    not null references public.meetups(id) on delete cascade,
  question_text text    not null check (char_length(question_text) between 1 and 500),
  display_order integer not null default 0,
  created_at    timestamptz not null default now()
);

alter table public.meetup_questions enable row level security;

create policy "meetup_questions: read for authenticated"
  on public.meetup_questions for select to authenticated using (true);

create policy "meetup_questions: manage by organiser"
  on public.meetup_questions for all to authenticated
  using (exists (
    select 1 from public.meetups m
    where m.id = meetup_id and m.organiser_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.meetups m
    where m.id = meetup_id and m.organiser_id = auth.uid()
  ));

-- meetup_registrations -------------------------------------------
create table public.meetup_registrations (
  id          uuid    primary key default gen_random_uuid(),
  meetup_id   uuid    not null references public.meetups(id) on delete cascade,
  user_id     uuid    not null references public.users(id) on delete cascade,
  is_waitlist boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (meetup_id, user_id)
);

alter table public.meetup_registrations enable row level security;

-- Registrant sees their own row; organiser sees all rows for their meetup.
-- All authenticated users can see the attendee list for display purposes.
create policy "meetup_registrations: read for authenticated"
  on public.meetup_registrations for select to authenticated using (true);

create policy "meetup_registrations: insert own"
  on public.meetup_registrations for insert to authenticated
  with check (user_id = auth.uid());

create policy "meetup_registrations: update by organiser"
  on public.meetup_registrations for update to authenticated
  using (exists (
    select 1 from public.meetups m
    where m.id = meetup_id and m.organiser_id = auth.uid()
  ));

create policy "meetup_registrations: delete own"
  on public.meetup_registrations for delete to authenticated
  using (user_id = auth.uid());

-- meetup_answers -------------------------------------------------
create table public.meetup_answers (
  id              uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.meetup_registrations(id) on delete cascade,
  question_id     uuid not null references public.meetup_questions(id) on delete cascade,
  answer_text     text not null check (char_length(answer_text) <= 500),
  created_at      timestamptz not null default now(),
  unique (registration_id, question_id)
);

alter table public.meetup_answers enable row level security;

-- Only the registrant or the organiser of the meetup can read answers.
create policy "meetup_answers: read own or organiser"
  on public.meetup_answers for select to authenticated
  using (
    exists (
      select 1 from public.meetup_registrations r
      where r.id = registration_id and r.user_id = auth.uid()
    )
    or exists (
      select 1
      from   public.meetup_registrations r
      join   public.meetups m on m.id = r.meetup_id
      where  r.id = registration_id and m.organiser_id = auth.uid()
    )
  );

create policy "meetup_answers: insert own"
  on public.meetup_answers for insert to authenticated
  with check (
    exists (
      select 1 from public.meetup_registrations r
      where r.id = registration_id and r.user_id = auth.uid()
    )
  );

-- meetup_needs ---------------------------------------------------
create table public.meetup_needs (
  id             uuid    primary key default gen_random_uuid(),
  meetup_id      uuid    not null references public.meetups(id) on delete cascade,
  description    text    not null check (char_length(description) between 1 and 500),
  estimated_cost text    check (char_length(estimated_cost) <= 200),
  status         text    not null default 'needed'
                         check (status in ('needed', 'offered', 'arranged')),
  offered_by     uuid    references public.users(id) on delete set null,
  added_by       uuid    not null references public.users(id) on delete cascade,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.meetup_needs enable row level security;

create policy "meetup_needs: read for authenticated"
  on public.meetup_needs for select to authenticated using (true);

-- Any confirmed (non-waitlist) attendee or the organiser can add needs.
create policy "meetup_needs: insert by attendee or organiser"
  on public.meetup_needs for insert to authenticated
  with check (
    added_by = auth.uid()
    and (
      exists (
        select 1 from public.meetup_registrations r
        where r.meetup_id = meetup_needs.meetup_id
          and r.user_id   = auth.uid()
          and r.is_waitlist = false
      )
      or exists (
        select 1 from public.meetups m
        where m.id = meetup_needs.meetup_id and m.organiser_id = auth.uid()
      )
    )
  );

-- Organiser can update any need; the user who offered can update their item.
create policy "meetup_needs: update by organiser or offered_by"
  on public.meetup_needs for update to authenticated
  using (
    offered_by = auth.uid()
    or exists (
      select 1 from public.meetups m
      where m.id = meetup_id and m.organiser_id = auth.uid()
    )
  );

-- Organiser or the user who added the item can delete.
create policy "meetup_needs: delete by organiser or adder"
  on public.meetup_needs for delete to authenticated
  using (
    added_by = auth.uid()
    or exists (
      select 1 from public.meetups m
      where m.id = meetup_id and m.organiser_id = auth.uid()
    )
  );

-- meetup_posts ---------------------------------------------------
-- Mirrors the posts table but keyed to meetup_id. Has an is_pinned flag
-- for organiser announcements. Ratings and flags reuse the existing
-- ratings/flags tables with content_type = 'meetup_post'.
create table public.meetup_posts (
  id              uuid    primary key default gen_random_uuid(),
  meetup_id       uuid    not null references public.meetups(id) on delete cascade,
  parent_post_id  uuid    references public.meetup_posts(id) on delete cascade,
  author_id       uuid    not null references public.users(id) on delete cascade,
  content         text    not null check (char_length(content) between 1 and 20000),
  is_pinned       boolean not null default false,
  is_collapsed    boolean not null default false,
  hold_state      text    not null default 'none'
                          check (hold_state in ('none', 'held', 'released')),
  hold_reasons    text[],
  hold_expires_at timestamptz,
  released_at     timestamptz,
  released_by     uuid    references public.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.meetup_posts enable row level security;

create policy "meetup_posts: read for authenticated"
  on public.meetup_posts for select to authenticated using (true);

create policy "meetup_posts: insert own"
  on public.meetup_posts for insert to authenticated
  with check (author_id = auth.uid());

-- Author can update their own posts.
create policy "meetup_posts: update by author"
  on public.meetup_posts for update to authenticated
  using  (author_id = auth.uid())
  with check (author_id = auth.uid());

-- Organiser can update any post (e.g. pin/unpin announcements).
create policy "meetup_posts: update by organiser"
  on public.meetup_posts for update to authenticated
  using (exists (
    select 1 from public.meetups m
    where m.id = meetup_id and m.organiser_id = auth.uid()
  ));

create policy "meetup_posts: delete by author"
  on public.meetup_posts for delete to authenticated
  using (author_id = auth.uid());

-- Organiser can also delete any post in their meetup.
create policy "meetup_posts: delete by organiser"
  on public.meetup_posts for delete to authenticated
  using (exists (
    select 1 from public.meetups m
    where m.id = meetup_id and m.organiser_id = auth.uid()
  ));
