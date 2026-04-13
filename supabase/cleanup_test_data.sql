/*
 * pleasejudgemefairly - test data cleanup
 *
 * WARNING: This script permanently deletes ALL content rows from the
 * database. It is intended to be run once before launch to remove any
 * test posts, threads, resources, ratings, flags, mutes, blocks, and
 * audit log entries created during development.
 *
 * What it does NOT touch:
 *   - public.users       (user accounts are preserved)
 *   - auth.users         (authentication records are preserved)
 *   - The database schema, indexes, policies, and functions
 *
 * The script is safe to re-run: all DELETE statements are
 * unconditional, so running it a second time is a no-op on already-
 * empty tables.
 *
 * Run this in the Supabase SQL editor (or via `psql`) with superuser
 * or service-role credentials so that RLS policies are bypassed.
 */

-- Order matters: delete children before parents to avoid FK violations.

delete from public.collapse_log;
delete from public.flags;
delete from public.ratings;
delete from public.mutes;
delete from public.blocks;
delete from public.resources;   -- includes the seeded book entry
delete from public.posts;       -- cascades to child replies via ON DELETE CASCADE
delete from public.threads;
