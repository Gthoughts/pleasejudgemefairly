// Admin-role helper.
//
// There is exactly one kind of elevated permission in this project: a
// small allow-list of email addresses stored in the ADMIN_EMAIL
// environment variable (comma-separated). Admins can release posts from
// the held-for-review queue early. They cannot delete content, edit
// other users' posts, or override rating decisions. This list is
// documented publicly in the README and can be inspected in the Vercel
// project settings by anyone with read access.
//
// The long-term plan, stated in the README, is to hand this role over
// to a rotating group elected by contributors once the site reaches
// 1,000 active users. Until then, the founder holds it.

import { cache } from 'react'
import { createServiceClient } from './supabase/service'

function parseAdminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAIL ?? ''
  return new Set(
    raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length > 0)
  )
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return parseAdminEmails().has(email.toLowerCase())
}

// Resolve admin email addresses to their database user IDs. Uses the
// service-role client so it always works regardless of the current
// user's auth state. Wrapped in React's `cache()` so multiple
// components on the same page share a single DB round-trip.
export const getAdminUserIds = cache(async (): Promise<Set<string>> => {
  const emails = parseAdminEmails()
  if (emails.size === 0) return new Set()

  try {
    const service = createServiceClient()
    const { data } = await service
      .from('users')
      .select('id')
      .in('email', Array.from(emails))
    return new Set((data ?? []).map((r) => (r as { id: string }).id))
  } catch {
    // If the service client is unavailable (e.g. missing env vars in a
    // test environment) fall back to an empty set so pages still render.
    return new Set()
  }
})

// Returns "site admin" if the author is one of the configured admin
// accounts, otherwise returns the stored username unchanged. Pass the
// Set returned by getAdminUserIds().
export function getDisplayUsername(
  authorId: string,
  username: string,
  adminIds: Set<string>
): string {
  return adminIds.has(authorId) ? 'site admin' : username
}
