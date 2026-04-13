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
