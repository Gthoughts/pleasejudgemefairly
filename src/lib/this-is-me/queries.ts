import type { createClient } from '@/lib/supabase/server'

export type Entry = {
  id: string
  user_id: string
  entry_type: 'text' | 'photo' | 'video'
  content: string | null
  media_url: string | null
  comments_enabled: boolean
  created_at: string
  updated_at: string
}

export type StorytellerRow = {
  user_id: string
  username: string
  entry_count: number
  first_entry_preview: string | null
  latest_entry_at: string
  first_entry_at: string
}

// Returns everyone who has at least one this_is_me entry, along with
// a preview of their first entry and their entry count. The caller
// applies ordering (random / latest / oldest / search) in memory.
export async function listStorytellers(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<StorytellerRow[]> {
  const { data: rows } = await supabase
    .from('this_is_me_entries')
    .select('user_id, content, entry_type, created_at, users:user_id(username)')
    .order('created_at', { ascending: true })
    .returns<
      {
        user_id: string
        content: string | null
        entry_type: 'text' | 'photo' | 'video'
        created_at: string
        users: { username: string } | null
      }[]
    >()

  const byUser = new Map<string, StorytellerRow>()
  for (const r of rows ?? []) {
    const existing = byUser.get(r.user_id)
    if (!existing) {
      byUser.set(r.user_id, {
        user_id: r.user_id,
        username: r.users?.username ?? 'unknown',
        entry_count: 1,
        first_entry_preview: previewFor(r.entry_type, r.content),
        first_entry_at: r.created_at,
        latest_entry_at: r.created_at,
      })
    } else {
      existing.entry_count += 1
      existing.latest_entry_at = r.created_at
    }
  }
  return Array.from(byUser.values())
}

function previewFor(
  type: 'text' | 'photo' | 'video',
  content: string | null
): string | null {
  if (type === 'text') {
    const t = (content ?? '').trim()
    if (!t) return null
    const firstLine = t.split(/\r?\n/, 1)[0] ?? ''
    return firstLine.slice(0, 140)
  }
  if (type === 'photo') return '(a photo)'
  if (type === 'video') return '(a video)'
  return null
}

export async function getEntriesForUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<Entry[]> {
  const { data } = await supabase
    .from('this_is_me_entries')
    .select(
      'id, user_id, entry_type, content, media_url, comments_enabled, created_at, updated_at'
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .returns<Entry[]>()
  return data ?? []
}

// Loves the current user has given, keyed by entry id.
export async function getOwnLovedEntryIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  entryIds: string[],
  userId: string
): Promise<Set<string>> {
  if (entryIds.length === 0) return new Set()
  const { data } = await supabase
    .from('this_is_me_loves')
    .select('entry_id')
    .eq('user_id', userId)
    .in('entry_id', entryIds)
  return new Set((data ?? []).map((r) => (r as { entry_id: string }).entry_id))
}

export type CommentRow = {
  id: string
  entry_id: string
  author_id: string
  content: string
  created_at: string
  users: { username: string } | null
}

// Comments grouped by entry id.
export async function getCommentsForEntries(
  supabase: Awaited<ReturnType<typeof createClient>>,
  entryIds: string[]
): Promise<Map<string, CommentRow[]>> {
  const map = new Map<string, CommentRow[]>()
  if (entryIds.length === 0) return map
  const { data } = await supabase
    .from('this_is_me_comments')
    .select('id, entry_id, author_id, content, created_at, users:author_id(username)')
    .in('entry_id', entryIds)
    .order('created_at', { ascending: true })
    .returns<CommentRow[]>()
  for (const c of data ?? []) {
    const arr = map.get(c.entry_id) ?? []
    arr.push(c)
    map.set(c.entry_id, arr)
  }
  return map
}
