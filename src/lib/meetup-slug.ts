import type { createClient } from '@/lib/supabase/server'

export const SLUG_MIN = 3
export const SLUG_MAX = 40
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

// Turn a free-text string (title or organiser input) into a slug that
// satisfies the meetups_slug_format check constraint. Returns null if
// nothing survives normalisation.
export function slugify(input: string): string | null {
  const cleaned = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, '')
  if (cleaned.length < SLUG_MIN) return null
  return cleaned
}

// Find a free slug by appending -2, -3, ... to `base` until one is
// available. Caller supplies an already-slugified base.
export async function findFreeSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  base: string,
  ignoreMeetupId?: string
): Promise<string> {
  let candidate = base
  let n = 1
  while (true) {
    let query = supabase.from('meetups').select('id').eq('slug', candidate).limit(1)
    if (ignoreMeetupId) query = query.neq('id', ignoreMeetupId)
    const { data, error } = await query
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) return candidate
    n += 1
    const suffix = `-${n}`
    candidate = base.slice(0, SLUG_MAX - suffix.length) + suffix
  }
}
