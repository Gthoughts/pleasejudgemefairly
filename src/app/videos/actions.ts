'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  slugifyCategoryName,
  normaliseCategoryName,
} from '@/lib/videos/categories'
import {
  detectPlatform,
  VIDEO_PLATFORMS,
  REJECTED_URL_MESSAGE,
  type VideoPlatform,
} from '@/lib/videos/platforms'
import { WATCH_GATE_PERCENT } from '@/lib/videos/watch'
import { REPORT_REASON_TYPES, type ReportReasonType } from '@/lib/videos/reports'
import { findRecentDuplicate } from '@/lib/dedupe'
import { runFilter, normaliseContent } from '@/lib/filters/filter'
import { FILTER_CONFIG } from '@/lib/filters/config'
import { RATING_CONFIG } from '@/lib/rating/config'
import { MAX_REPLY_DEPTH } from '@/lib/discuss'
import { sendBadgePush } from '@/lib/push/server'

const MAX_TITLE = 200
const MAX_DESCRIPTION = 2000
const MAX_COMMENT = 20_000

function requireString(value: FormDataEntryValue | null, field: string): string {
  if (typeof value !== 'string') throw new Error(`Missing ${field}`)
  return value
}

function optionalString(value: FormDataEntryValue | null): string | null {
  if (typeof value !== 'string') return null
  const t = value.trim()
  return t.length === 0 ? null : t
}

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('You must be signed in.')
  return { supabase, user }
}

// ------------------------------------------------------------------
// Hold computation for video posts (comments). Same shape as the
// pattern used for user_project_posts.
// ------------------------------------------------------------------

async function computeVideoPostHold(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  rawContent: string
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

  const windowMs = FILTER_CONFIG.duplicateWindowHours * 60 * 60 * 1000
  const since = new Date(Date.now() - windowMs).toISOString()
  const { data: recent } = await supabase
    .from('video_posts')
    .select('content')
    .eq('author_id', userId)
    .gte('created_at', since)

  const recentNormalised = (recent ?? []).map((p) =>
    normaliseContent((p as { content: string }).content)
  )

  const result = runFilter(rawContent, {
    authorAccountAgeDays: ageDays,
    recentNormalisedPosts: recentNormalised,
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

// Same shape but for videos: filter runs against title + description
// (URL is included if external). Held videos are hidden from the
// feed until the hold expires or an admin releases.
async function computeVideoHold(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  title: string,
  description: string | null,
  externalUrl: string | null
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

  const rawContent = [externalUrl ?? '', title, description ?? '']
    .filter(Boolean)
    .join(' ')

  const result = runFilter(rawContent, {
    authorAccountAgeDays: ageDays,
    recentNormalisedPosts: [],
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
  return {
    hold_state: 'held',
    hold_reasons: result.reasons,
    hold_expires_at: new Date(Date.now() + holdWindowMs).toISOString(),
    filterReasons: result.reasons,
  }
}

async function recordAutoFlagsForVideo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  videoId: string,
  reasons: string[]
) {
  if (reasons.length === 0) return
  const rows = reasons.map((r) => ({
    content_type: 'video' as const,
    content_id: videoId,
    reason: `auto:${r}`,
    auto_flagged: true,
    reporter_id: null,
  }))
  await supabase.from('flags').insert(rows)
}

async function videoCommentDepth(
  supabase: Awaited<ReturnType<typeof createClient>>,
  postId: string
): Promise<number> {
  let depth = 0
  let currentId: string | null = postId
  while (currentId && depth < MAX_REPLY_DEPTH + 1) {
    const { data }: { data: { parent_post_id: string | null } | null } =
      await supabase
        .from('video_posts')
        .select('parent_post_id')
        .eq('id', currentId)
        .maybeSingle<{ parent_post_id: string | null }>()
    if (!data) break
    if (!data.parent_post_id) return depth
    depth++
    currentId = data.parent_post_id
  }
  return depth
}

// ------------------------------------------------------------------
// Submit a video (either external link or uploaded file reference).
// ------------------------------------------------------------------

export async function submitVideoAction(formData: FormData) {
  const sourceType = requireString(formData.get('source_type'), 'source_type')
  if (sourceType !== 'external' && sourceType !== 'upload')
    throw new Error('Invalid source_type.')

  const title = requireString(formData.get('title'), 'title').trim()
  if (title.length < 1 || title.length > MAX_TITLE)
    throw new Error(`Title must be 1 to ${MAX_TITLE} characters.`)

  const description = optionalString(formData.get('description'))
  if (description && description.length > MAX_DESCRIPTION)
    throw new Error(`Description must be at most ${MAX_DESCRIPTION} characters.`)

  const categoryId = requireString(formData.get('category_id'), 'category_id')
  const subcategoryId = optionalString(formData.get('subcategory_id'))
  const aspectRatioRaw = optionalString(formData.get('aspect_ratio'))
  const aspectRatio =
    aspectRatioRaw === 'portrait' ||
    aspectRatioRaw === 'landscape' ||
    aspectRatioRaw === 'square'
      ? aspectRatioRaw
      : null
  const durationRaw = optionalString(formData.get('duration_seconds'))
  const duration = durationRaw ? Number(durationRaw) : null
  if (duration !== null && (!Number.isFinite(duration) || duration < 1))
    throw new Error('Invalid duration.')

  let externalUrl: string | null = null
  let externalPlatform: VideoPlatform | null = null
  let storageRef: string | null = null

  if (sourceType === 'external') {
    externalUrl = requireString(formData.get('external_url'), 'external_url').trim()
    if (!externalUrl.startsWith('http://') && !externalUrl.startsWith('https://'))
      throw new Error('URL must start with http:// or https://')
    const detected = detectPlatform(externalUrl)
    if (detected === null) throw new Error(REJECTED_URL_MESSAGE)
    // Allow uploader to override platform (rare, only useful if we
    // mis-detect a supported URL as a different supported platform).
    const platformOverride = optionalString(formData.get('external_platform'))
    externalPlatform =
      platformOverride && (VIDEO_PLATFORMS as readonly string[]).includes(platformOverride)
        ? (platformOverride as VideoPlatform)
        : detected
  } else {
    storageRef = requireString(formData.get('storage_ref'), 'storage_ref').trim()
    if (storageRef.length === 0) throw new Error('Missing storage reference.')
  }

  const { supabase, user } = await requireUser()

  // Dedupe: same uploader submitting the same URL or storage ref
  // within the last 45 seconds is treated as a double-click.
  {
    const match: Record<string, string | null> = { source_type: sourceType }
    if (externalUrl) match.external_url = externalUrl
    if (storageRef) match.storage_ref = storageRef
    const existingId = await findRecentDuplicate(supabase, {
      table: 'videos',
      userColumn: 'uploader_id',
      userId: user.id,
      match,
    })
    if (existingId) {
      revalidatePath('/videos')
      redirect(`/videos/${existingId}`)
    }
  }

  const hold = await computeVideoHold(
    supabase,
    user.id,
    title,
    description,
    externalUrl
  )

  const { data: inserted, error } = await supabase
    .from('videos')
    .insert({
      uploader_id: user.id,
      source_type: sourceType,
      external_url: externalUrl,
      external_platform: externalPlatform,
      storage_ref: storageRef,
      title,
      description,
      duration_seconds: duration,
      aspect_ratio: aspectRatio,
      category_id: categoryId,
      subcategory_id: subcategoryId,
      hold_state: hold.hold_state,
      hold_reasons: hold.hold_reasons,
      hold_expires_at: hold.hold_expires_at,
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)

  if (hold.filterReasons.length > 0 && inserted) {
    await recordAutoFlagsForVideo(supabase, inserted.id, hold.filterReasons)
  }

  revalidatePath('/videos')
  if (inserted) redirect(`/videos/${inserted.id}`)
}

// ------------------------------------------------------------------
// Create a new category ("other" flow during upload). Lands as
// pending_review; admin picks it up on /review Taxonomy.
// ------------------------------------------------------------------

export async function createVideoCategoryAction(
  formData: FormData
): Promise<{ id: string; slug: string; name: string }> {
  const { supabase, user } = await requireUser()
  const rawName = requireString(formData.get('name'), 'name')
  const name = normaliseCategoryName(rawName)
  if (name.length === 0) throw new Error('Category name is required.')
  const slug = slugifyCategoryName(name)
  if (slug.length === 0) throw new Error('Category name must contain letters or numbers.')

  // If a live category with this slug already exists, just return
  // it — the uploader clearly meant that one.
  {
    const { data: existing } = await supabase
      .from('video_categories')
      .select('id, slug, name')
      .eq('slug', slug)
      .maybeSingle<{ id: string; slug: string; name: string }>()
    if (existing) return existing
  }

  const { data, error } = await supabase
    .from('video_categories')
    .insert({
      slug,
      name,
      status: 'pending_review',
      created_by: user.id,
    })
    .select('id, slug, name')
    .single()
  if (error) throw new Error(error.message)
  return data as { id: string; slug: string; name: string }
}

export async function createVideoSubcategoryAction(
  formData: FormData
): Promise<{ id: string; slug: string; name: string }> {
  const { supabase, user } = await requireUser()
  const categoryId = requireString(formData.get('category_id'), 'category_id')
  const rawName = requireString(formData.get('name'), 'name')
  const name = normaliseCategoryName(rawName)
  if (name.length === 0) throw new Error('Subcategory name is required.')
  const slug = slugifyCategoryName(name)
  if (slug.length === 0) throw new Error('Subcategory name must contain letters or numbers.')

  {
    const { data: existing } = await supabase
      .from('video_subcategories')
      .select('id, slug, name')
      .eq('category_id', categoryId)
      .eq('slug', slug)
      .maybeSingle<{ id: string; slug: string; name: string }>()
    if (existing) return existing
  }

  const { data, error } = await supabase
    .from('video_subcategories')
    .insert({
      category_id: categoryId,
      slug,
      name,
      status: 'pending_review',
      created_by: user.id,
    })
    .select('id, slug, name')
    .single()
  if (error) throw new Error(error.message)
  return data as { id: string; slug: string; name: string }
}

// ------------------------------------------------------------------
// Watch heartbeat. Client sends the max watched_seconds it's ever
// observed for this (user, video). Server upserts, calculates the
// percent, and if the user has crossed WATCH_GATE_PERCENT for the
// first time, sets first_qualified_at (which fires the trigger to
// bump videos.qualified_views).
// ------------------------------------------------------------------

export async function reportWatchProgressAction(formData: FormData) {
  const { supabase, user } = await requireUser()
  const videoId = requireString(formData.get('video_id'), 'video_id')
  const watchedSecondsRaw = requireString(
    formData.get('watched_seconds'),
    'watched_seconds'
  )
  const watchedSeconds = Math.max(0, Math.floor(Number(watchedSecondsRaw)))
  if (!Number.isFinite(watchedSeconds))
    throw new Error('Invalid watched_seconds.')

  // Fetch the video's duration so we can compute a real percent.
  const { data: video } = await supabase
    .from('videos')
    .select('duration_seconds')
    .eq('id', videoId)
    .maybeSingle<{ duration_seconds: number | null }>()
  if (!video) throw new Error('Video not found.')
  const duration = video.duration_seconds

  const percent =
    duration && duration > 0
      ? Math.min(100, (watchedSeconds / duration) * 100)
      : 0
  const nowIso = new Date().toISOString()
  const qualified = percent >= WATCH_GATE_PERCENT

  // Read prior row to preserve max watched_seconds and detect first
  // qualification. Row may not exist yet.
  const { data: prior } = await supabase
    .from('video_views')
    .select('id, watched_seconds, first_qualified_at')
    .eq('video_id', videoId)
    .maybeSingle<{
      id: string
      watched_seconds: number
      first_qualified_at: string | null
    }>()

  if (prior) {
    const maxWatched = Math.max(prior.watched_seconds, watchedSeconds)
    const newQualifiedAt =
      prior.first_qualified_at ?? (qualified ? nowIso : null)
    await supabase
      .from('video_views')
      .update({
        watched_seconds: maxWatched,
        watched_percent:
          duration && duration > 0
            ? Math.min(100, (maxWatched / duration) * 100)
            : 0,
        first_qualified_at: newQualifiedAt,
        last_heartbeat_at: nowIso,
      })
      .eq('id', prior.id)
  } else {
    await supabase.from('video_views').insert({
      video_id: videoId,
      user_id: user.id,
      watched_seconds: watchedSeconds,
      watched_percent: percent,
      first_qualified_at: qualified ? nowIso : null,
      last_heartbeat_at: nowIso,
    })
  }
}

// ------------------------------------------------------------------
// Vote on a video (helpful / unhelpful / clear). RLS enforces the
// 50% watch gate; we surface a friendly error instead of the raw
// Postgres one.
// ------------------------------------------------------------------

export async function voteOnVideoAction(formData: FormData) {
  const { supabase, user } = await requireUser()
  const videoId = requireString(formData.get('video_id'), 'video_id')
  const rating = formData.get('rating')

  if (rating === '' || rating === null) {
    const { error } = await supabase
      .from('ratings')
      .delete()
      .eq('user_id', user.id)
      .eq('content_type', 'video')
      .eq('content_id', videoId)
    if (error) throw new Error(error.message)
    revalidatePath(`/videos/${videoId}`)
    return
  }

  if (rating !== 'helpful' && rating !== 'unhelpful')
    throw new Error('Invalid rating value.')

  const { error } = await supabase.from('ratings').upsert(
    {
      user_id: user.id,
      content_type: 'video',
      content_id: videoId,
      rating,
    },
    { onConflict: 'user_id,content_type,content_id' }
  )
  if (error) {
    if (error.message.toLowerCase().includes('policy')) {
      throw new Error(
        `Watch at least ${WATCH_GATE_PERCENT}% of the video before voting.`
      )
    }
    throw new Error(error.message)
  }
  revalidatePath(`/videos/${videoId}`)
}

// ------------------------------------------------------------------
// Report a video. Inserts into video_reports; the DB trigger holds
// the video immediately. Any RLS rejection (revoked privilege) or
// duplicate insert is rethrown as a friendly message.
// ------------------------------------------------------------------

export async function reportVideoAction(formData: FormData) {
  const { supabase, user } = await requireUser()
  const videoId = requireString(formData.get('video_id'), 'video_id')
  const reasonRaw = requireString(formData.get('reason_type'), 'reason_type')
  if (!(REPORT_REASON_TYPES as readonly string[]).includes(reasonRaw))
    throw new Error('Invalid reason.')
  const reasonType = reasonRaw as ReportReasonType
  const note = optionalString(formData.get('note'))
  if (note && note.length > 500)
    throw new Error('Note must be at most 500 characters.')

  // Belt-and-braces rate limit check. RLS enforces revocation; the
  // 24h count is checked by the RPC.
  const { data: canReport } = await supabase.rpc('can_report_video')
  if (canReport !== true)
    throw new Error(
      'You cannot report right now. Either your report privilege has been revoked or you have hit the daily limit.'
    )

  const { error } = await supabase.from('video_reports').insert({
    video_id: videoId,
    reporter_id: user.id,
    reason_type: reasonType,
    note,
  })
  if (error) {
    if (error.code === '23505') {
      throw new Error('You have already reported this video.')
    }
    if (error.message.toLowerCase().includes('policy')) {
      throw new Error('Your ability to report videos has been revoked.')
    }
    throw new Error(error.message)
  }

  revalidatePath('/videos')
  revalidatePath(`/videos/${videoId}`)
}

// ------------------------------------------------------------------
// Delete your own video.
// ------------------------------------------------------------------

export async function deleteVideoAction(formData: FormData) {
  const { supabase } = await requireUser()
  const videoId = requireString(formData.get('video_id'), 'video_id')
  const { error } = await supabase.from('videos').delete().eq('id', videoId)
  if (error) throw new Error(error.message)
  revalidatePath('/videos')
  redirect('/videos')
}

// ------------------------------------------------------------------
// Edit your own video (title, description, subcategory only).
// ------------------------------------------------------------------

export async function editVideoAction(formData: FormData) {
  const { supabase } = await requireUser()
  const videoId = requireString(formData.get('video_id'), 'video_id')
  const title = requireString(formData.get('title'), 'title').trim()
  if (title.length < 1 || title.length > MAX_TITLE)
    throw new Error(`Title must be 1 to ${MAX_TITLE} characters.`)
  const description = optionalString(formData.get('description'))
  if (description && description.length > MAX_DESCRIPTION)
    throw new Error(`Description must be at most ${MAX_DESCRIPTION} characters.`)
  const subcategoryId = optionalString(formData.get('subcategory_id'))

  const { error } = await supabase
    .from('videos')
    .update({
      title,
      description,
      subcategory_id: subcategoryId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', videoId)
  if (error) throw new Error(error.message)
  revalidatePath(`/videos/${videoId}`)
}

// ------------------------------------------------------------------
// Video comments (reddit-style forum per video)
// ------------------------------------------------------------------

export async function createVideoCommentAction(formData: FormData) {
  const { supabase, user } = await requireUser()
  const videoId = requireString(formData.get('video_id'), 'video_id')
  const content = requireString(formData.get('content'), 'content').trim()
  if (content.length < 1 || content.length > MAX_COMMENT)
    throw new Error(`Comment must be 1 to ${MAX_COMMENT} characters.`)

  {
    const existingId = await findRecentDuplicate(supabase, {
      table: 'video_posts',
      userColumn: 'author_id',
      userId: user.id,
      match: {
        video_id: videoId,
        parent_post_id: null,
        content,
      },
    })
    if (existingId) {
      revalidatePath(`/videos/${videoId}`)
      return
    }
  }

  const hold = await computeVideoPostHold(supabase, user.id, content)
  const { error } = await supabase.from('video_posts').insert({
    video_id: videoId,
    parent_post_id: null,
    author_id: user.id,
    content,
    hold_state: hold.hold_state,
    hold_reasons: hold.hold_reasons,
    hold_expires_at: hold.hold_expires_at,
  })
  if (error) throw new Error(error.message)
  revalidatePath(`/videos/${videoId}`)
}

export async function replyToVideoCommentAction(formData: FormData) {
  const { supabase, user } = await requireUser()
  const videoId = requireString(formData.get('video_id'), 'video_id')
  const parentPostId = requireString(
    formData.get('parent_post_id'),
    'parent_post_id'
  )
  const content = requireString(formData.get('content'), 'content').trim()
  if (content.length < 1 || content.length > MAX_COMMENT)
    throw new Error(`Reply must be 1 to ${MAX_COMMENT} characters.`)

  const parentDepth = await videoCommentDepth(supabase, parentPostId)
  if (parentDepth >= MAX_REPLY_DEPTH)
    throw new Error(
      `Replies can only be nested ${MAX_REPLY_DEPTH} levels deep.`
    )

  {
    const existingId = await findRecentDuplicate(supabase, {
      table: 'video_posts',
      userColumn: 'author_id',
      userId: user.id,
      match: {
        video_id: videoId,
        parent_post_id: parentPostId,
        content,
      },
    })
    if (existingId) {
      revalidatePath(`/videos/${videoId}`)
      return
    }
  }

  const hold = await computeVideoPostHold(supabase, user.id, content)
  const { error } = await supabase.from('video_posts').insert({
    video_id: videoId,
    parent_post_id: parentPostId,
    author_id: user.id,
    content,
    hold_state: hold.hold_state,
    hold_reasons: hold.hold_reasons,
    hold_expires_at: hold.hold_expires_at,
  })
  if (error) throw new Error(error.message)

  // Silent home-screen badge push to the parent post's author, same
  // pattern as other reply flows.
  const { data: parent } = await supabase
    .from('video_posts')
    .select('author_id')
    .eq('id', parentPostId)
    .maybeSingle<{ author_id: string }>()
  if (parent && parent.author_id !== user.id) {
    try {
      await sendBadgePush(parent.author_id)
    } catch {
      // best-effort, don't fail the action
    }
  }

  revalidatePath(`/videos/${videoId}`)
}

export async function editVideoCommentAction(formData: FormData) {
  const { supabase } = await requireUser()
  const videoId = requireString(formData.get('video_id'), 'video_id')
  const postId = requireString(formData.get('post_id'), 'post_id')
  const content = requireString(formData.get('content'), 'content').trim()
  if (content.length < 1 || content.length > MAX_COMMENT)
    throw new Error(`Comment must be 1 to ${MAX_COMMENT} characters.`)

  const { error } = await supabase
    .from('video_posts')
    .update({ content, updated_at: new Date().toISOString() })
    .eq('id', postId)
  if (error) throw new Error(error.message)
  revalidatePath(`/videos/${videoId}`)
}

export async function deleteVideoCommentAction(formData: FormData) {
  const { supabase } = await requireUser()
  const videoId = requireString(formData.get('video_id'), 'video_id')
  const postId = requireString(formData.get('post_id'), 'post_id')
  const { error } = await supabase.from('video_posts').delete().eq('id', postId)
  if (error) throw new Error(error.message)
  revalidatePath(`/videos/${videoId}`)
}

export async function rateVideoCommentAction(formData: FormData) {
  const { supabase, user } = await requireUser()
  const videoId = requireString(formData.get('video_id'), 'video_id')
  const postId = requireString(formData.get('post_id'), 'post_id')
  const rating = formData.get('rating')

  if (rating === '' || rating === null) {
    await supabase
      .from('ratings')
      .delete()
      .eq('user_id', user.id)
      .eq('content_type', 'video_post')
      .eq('content_id', postId)
    revalidatePath(`/videos/${videoId}`)
    return
  }
  if (rating !== 'helpful' && rating !== 'unhelpful')
    throw new Error('Invalid rating value.')

  const { error } = await supabase.from('ratings').upsert(
    {
      user_id: user.id,
      content_type: 'video_post',
      content_id: postId,
      rating,
    },
    { onConflict: 'user_id,content_type,content_id' }
  )
  if (error) throw new Error(error.message)
  revalidatePath(`/videos/${videoId}`)
}
