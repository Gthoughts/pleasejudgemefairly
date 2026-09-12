/*
 * a place for you - Phase 27 migration: robust signup / username handling
 *
 * FIXES a production bug: signup returned HTTP 500 with
 * "duplicate key value violates unique constraint users_username_key"
 * when someone chose a username that was already taken. The auth
 * user got created but the public.users insert in the trigger threw,
 * aborting the transaction, so the whole signup failed with a cryptic
 * 500 instead of a friendly "that name is taken" message.
 *
 * Two changes:
 *
 * 1. Harden public.handle_new_auth_user() so a username clash NEVER
 *    aborts signup: if the requested username is taken, append a short
 *    numeric suffix until it's free (nia -> nia2 -> nia3 ...). The
 *    person gets in and can change their username later.
 *
 * 2. Add a SECURITY DEFINER RPC public.username_available(text) that
 *    the (unauthenticated) signup form can call to check availability
 *    up front and show a friendly message BEFORE creating the account.
 *    RLS on public.users blocks anon reads, so a definer function is
 *    the safe way to expose just this one boolean.
 *
 * Run this once in the Supabase SQL editor after phase 26.
 */

------------------------------------------------------------------
-- 1. Harden the auto-provision trigger against username clashes.
------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested text;
  candidate text;
  suffix    integer := 1;
begin
  -- Start from the requested username, or a safe fallback.
  requested := coalesce(
    nullif(trim(new.raw_user_meta_data->>'username'), ''),
    'user_' || substr(new.id::text, 1, 8)
  );
  -- Clamp to the column's 3..32 length rule.
  requested := left(requested, 32);
  if char_length(requested) < 3 then
    requested := 'user_' || substr(new.id::text, 1, 8);
  end if;

  candidate := requested;

  -- If taken, append an incrementing suffix until free. Bounded loop
  -- so a pathological case can never spin forever.
  while exists (select 1 from public.users u where u.username = candidate) loop
    suffix := suffix + 1;
    candidate := left(requested, 30) || suffix::text;
    if suffix > 10000 then
      candidate := 'user_' || substr(new.id::text, 1, 8) || suffix::text;
      exit;
    end if;
  end loop;

  insert into public.users (id, username, email, email_verified)
  values (
    new.id,
    candidate,
    new.email,
    new.email_confirmed_at is not null
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

------------------------------------------------------------------
-- 2. Public availability check for the signup form (pre-auth).
--    SECURITY DEFINER so it can read public.users despite RLS, but
--    it only ever returns a boolean, never any user data.
------------------------------------------------------------------
create or replace function public.username_available(candidate text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.users u
    where lower(u.username) = lower(trim(candidate))
  );
$$;

-- Allow both anonymous (signing-up) and authenticated callers.
grant execute on function public.username_available(text) to anon, authenticated;
