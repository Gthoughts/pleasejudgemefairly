// Inbox helpers. Kept out of the components that use them so the same
// helpers can be called from SectionHeader (to render the badge) and
// from the /inbox page (to mark-as-seen). Both use the caller's own
// authenticated Supabase client — no service role needed.

import type { SupabaseClient } from '@supabase/supabase-js'

// Count of replies to the current user's posts that arrived since they
// last looked at /inbox. Returns 0 on any error so the header renders
// without a spurious badge if the phase10 migration hasn't run yet.
export async function getInboxUnreadCount(
  supabase: SupabaseClient,
): Promise<number> {
  const { data, error } = await supabase.rpc('inbox_unread_count')
  if (error || typeof data !== 'number') return 0
  return data
}

// Reset the "last seen" timestamp on the users row for the signed-in
// user. Idempotent, tolerant of the migration not having run (silently
// no-ops on error).
export async function markInboxSeen(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  await supabase
    .from('users')
    .update({ inbox_last_seen_at: new Date().toISOString() })
    .eq('id', userId)
}
