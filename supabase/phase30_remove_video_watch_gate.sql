/*
 * a place for you - Phase 30 migration: remove the video watch-vote gate
 *
 * The videos feature originally required a member to watch 50% of a video
 * (tracked in video_views.first_qualified_at) before their rating would be
 * accepted. This was enforced by a RESTRICTIVE RLS policy on public.ratings
 * called "ratings: video watch gate".
 *
 * Now that videos are upload-only and the feed is a small community space,
 * that gate is unwanted friction and it was rejecting legitimate votes
 * (uploaded native videos often have no stored duration, so the gate could
 * never be satisfied). We remove the restrictive policy so any signed-in
 * member can rate a video. The normal (permissive) ratings insert policy
 * still applies, so a member can still only insert their OWN rating.
 *
 * Safe to run once in the Supabase SQL editor after phase 29.
 */

drop policy if exists "ratings: video watch gate" on public.ratings;
