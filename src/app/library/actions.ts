'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getLibraryCategory } from '@/lib/library-categories'
import { runFilter, normaliseContent } from '@/lib/filters/filter'
import { FILTER_CONFIG } from '@/lib/filters/config'
import { RATING_CONFIG } from '@/lib/rating/config'

// Matches the DB check constraint in schema.sql.
const MAX_TITLE = 300
// Spec limit: description capped at 500 chars in the UI (DB allows 2000).
const MAX_DESCRIPTION = 500

function requireString(value: FormDataEntryValue | null, field: string): string {
  if (typeof value !== 'string') throw new Error(`Missing ${field}`)
  return value
}

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('You must be signed in.')
  return { supabase, user }
}

// Run the automatic content filter against URL + title + description
// combined, using the same hold machinery as for posts.
async function computeResourceHold(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  url: string,
  title: string,
  description: string
): Promise<{
  hold_state: 'none' | 'held'
  hold_reasons: string[] | null
  hold_expires_at: string | null
  filterReasons: string[]
}> {
  const { data: userRow } = await supabase
    .from('users')
    .select('created_at')
    .eq('id', userId)
    .maybeSingle<{ created_at: string }>()
  const ageDays =
    userRow?.created_at !== undefined
      ? (Date.now() - new Date(userRow.created_at).getTime()) /
        (1000 * 60 * 60 * 24)
      : null

  // Fetch recent resource submissions for duplicate detection.
  const windowMs = FILTER_CONFIG.duplicateWindowHours * 60 * 60 * 1000
  const since = new Date(Date.now() - windowMs).toISOString()
  const { data: recent } = await supabase
    .from('resources')
    .select('url, description')
    .eq('submitter_id', userId)
    .gte('created_at', since)

  const recentNormalisedPosts = (recent ?? []).map((r) => {
    const row = r as { url: string; description: string }
    return normaliseContent(`${row.url} ${row.description}`)
  })

  const rawContent = `${url} ${title} ${description}`
  const result = runFilter(rawContent, {
    authorAccountAgeDays: ageDays,
    recentNormalisedPosts,
  })

  if (!result.held) {
    return {
      hold_state: 'none',
      hold_reasons: null,
      hold_expires_at: null,
      filterReasons: [],
    }
  }

  const holdWindowMs = RATING_CONFIG.holdWindowHours * 60 * 60 * 1000
  const expiresAt = new Date(Date.now() + holdWindowMs).toISOString()

  return {
    hold_state: 'held',
    hold_reasons: result.reasons,
    hold_expires_at: expiresAt,
    filterReasons: result.reasons,
  }
}

async function recordAutoFlagsForResource(
  supabase: Awaited<ReturnType<typeof createClient>>,
  resourceId: string,
  reasons: string[]
) {
  if (reasons.length === 0) return
  const rows = reasons.map((reason) => ({
    content_type: 'resource' as const,
    content_id: resourceId,
    reason: `auto:${reason}`,
    auto_flagged: true,
    reporter_id: null,
  }))
  await supabase.from('flags').insert(rows)
}

// --------------------------------------------------------------------------
// Submit a new resource
// --------------------------------------------------------------------------

export async function submitResourceAction(formData: FormData) {
  const category = requireString(formData.get('category'), 'category').trim()
  const url = requireString(formData.get('url'), 'url').trim()
  const title = requireString(formData.get('title'), 'title').trim()
  const description = requireString(
    formData.get('description'),
    'description'
  ).trim()

  if (!getLibraryCategory(category)) throw new Error('Unknown category.')
  if (!url.startsWith('http://') && !url.startsWith('https://'))
    throw new Error('URL must start with http:// or https://')
  if (title.length < 1 || title.length > MAX_TITLE)
    throw new Error(`Title must be 1–${MAX_TITLE} characters.`)
  if (description.length < 1 || description.length > MAX_DESCRIPTION)
    throw new Error(`Description must be 1–${MAX_DESCRIPTION} characters.`)

  const { supabase, user } = await requireUser()

  const hold = await computeResourceHold(supabase, user.id, url, title, description)

  const { data: inserted, error } = await supabase
    .from('resources')
    .insert({
      category,
      url,
      title,
      description,
      submitter_id: user.id,
      hold_state: hold.hold_state,
      hold_reasons: hold.hold_reasons,
      hold_expires_at: hold.hold_expires_at,
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)

  if (hold.filterReasons.length > 0 && inserted) {
    await recordAutoFlagsForResource(supabase, inserted.id, hold.filterReasons)
  }

  revalidatePath(`/library/${category}`)
  redirect(`/library/${category}/${inserted.id}`)
}

// --------------------------------------------------------------------------
// Cross-perspective rating for resources
// --------------------------------------------------------------------------

// Same contract as rateAction in discuss/actions.ts but targets
// content_type='resource'. The cron job picks up these ratings in its
// second pass (after post ratings).
export async function rateResourceAction(formData: FormData) {
  const resourceId = requireString(formData.get('resource_id'), 'resource_id')
  const rating = formData.get('rating')
  const redirectPath = requireString(
    formData.get('redirect_to'),
    'redirect_to'
  )

  const { supabase, user } = await requireUser()

  if (rating === '' || rating === null) {
    const { error } = await supabase
      .from('ratings')
      .delete()
      .eq('user_id', user.id)
      .eq('content_type', 'resource')
      .eq('content_id', resourceId)
    if (error) throw new Error(error.message)
  } else if (rating === 'helpful' || rating === 'unhelpful') {
    const { error } = await supabase
      .from('ratings')
      .upsert(
        {
          user_id: user.id,
          content_type: 'resource',
          content_id: resourceId,
          rating,
        },
        { onConflict: 'user_id,content_type,content_id' }
      )
    if (error) throw new Error(error.message)
  } else {
    throw new Error('Invalid rating value.')
  }

  revalidatePath(redirectPath)
}

// --------------------------------------------------------------------------
// Broken-link flag
// --------------------------------------------------------------------------

// Records one broken-link flag per user per resource. The trigger
// `on_broken_link_flag_inserted` (added in phase4_migration.sql)
// automatically increments resources.broken_flag_count. The unique
// partial index `flags_broken_link_unique_idx` enforces one flag per
// user, so a duplicate insert from a race condition is silently ignored.
export async function flagBrokenLinkAction(formData: FormData) {
  const resourceId = requireString(formData.get('resource_id'), 'resource_id')
  const redirectPath = requireString(
    formData.get('redirect_to'),
    'redirect_to'
  )

  const { supabase, user } = await requireUser()

  // Insert the flag. If the unique index fires (already flagged by this
  // user) Supabase returns a 409/23505 error which we ignore quietly.
  const { error } = await supabase.from('flags').insert({
    content_type: 'resource',
    content_id: resourceId,
    reason: 'broken_link',
    auto_flagged: false,
    reporter_id: user.id,
  })

  if (error && !error.message.includes('duplicate') && !error.code?.includes('23505')) {
    throw new Error(error.message)
  }

  revalidatePath(redirectPath)
}
