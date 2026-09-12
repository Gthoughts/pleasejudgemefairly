/*
 * a place for you - Phase 26 migration: meetup site charge / camping fee
 *
 * Some meetups (e.g. overnight wild-camp stays) have a venue/campsite
 * charge that attendees pay DIRECTLY to the site operators. The platform
 * never charges for meetups — this is purely to make the standard cost
 * (often a discount the organiser arranged) transparent up front.
 *
 *   has_fee           Whether this meetup has a site charge / camping fee.
 *   fee_normal_pence  The normal per-person price, stored in pence (£15 = 1500)
 *                     to avoid floating-point money errors.
 *   fee_discount_pence  The discounted per-person price the organiser
 *                     arranged, in pence. NULL when there is no discount.
 *
 * All nullable / defaulted so existing meetups are untouched (no fee shown).
 * No online payment is taken — this is display-only transparency.
 *
 * Run this once in the Supabase SQL editor after phase 25.
 */

alter table public.meetups
  add column if not exists has_fee            boolean not null default false,
  add column if not exists fee_normal_pence   integer,
  add column if not exists fee_discount_pence integer;
