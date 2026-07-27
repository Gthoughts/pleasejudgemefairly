// Server-side "did this user just submit this exact thing?" check.
//
// Users routinely double-click submit when a form does not give
// instant feedback. Instead of writing four almost-identical rows we
// look for a matching row in a short window (default 45 seconds) and
// treat the second click as a no-op that resolves to the existing
// row's id. Cheap: single indexed query per action.

import type { createClient } from './supabase/server'

type ServerClient = Awaited<ReturnType<typeof createClient>>

export const DUPLICATE_WINDOW_SECONDS = 45

// Returns the id of a recently-inserted matching row for the given
// user, or null if none exists inside the window.
export async function findRecentDuplicate(
  supabase: ServerClient,
  opts: {
    table: string
    userColumn: string
    userId: string
    // Additional columns that must all match. Values of null are
    // matched with `.is(col, null)` so parent_post_id = null works.
    match: Record<string, string | number | boolean | null>
    windowSeconds?: number
  }
): Promise<string | null> {
  const windowSeconds = opts.windowSeconds ?? DUPLICATE_WINDOW_SECONDS
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString()

  let query = supabase
    .from(opts.table)
    .select('id')
    .eq(opts.userColumn, opts.userId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1)

  for (const [col, value] of Object.entries(opts.match)) {
    if (value === null) {
      query = query.is(col, null)
    } else {
      query = query.eq(col, value)
    }
  }

  const { data } = await query.maybeSingle<{ id: string }>()
  return data?.id ?? null
}
