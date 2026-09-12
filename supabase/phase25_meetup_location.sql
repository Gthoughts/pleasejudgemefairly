/*
 * a place for you - Phase 25 migration: meetup location map
 *
 * Adds a postcode + geocoded coordinates to meetups so the meetup
 * page can show a small OpenStreetMap of roughly where it is.
 *
 *   postcode   The organiser's postcode for the venue, or 'N/A' when
 *              unknown or the event is online. Free text (validated in
 *              the app against postcodes.io).
 *   latitude   Looked up from the postcode via postcodes.io when the
 *   longitude   meetup is created/edited, and stored so the map loads
 *              instantly without a live lookup on every page view.
 *
 * All three are nullable so existing meetups keep working untouched;
 * their map simply doesn't show until an organiser edits them and adds
 * a postcode.
 *
 * Run this once in the Supabase SQL editor after phase 24.
 */

alter table public.meetups
  add column if not exists postcode  text,
  add column if not exists latitude  double precision,
  add column if not exists longitude double precision;
