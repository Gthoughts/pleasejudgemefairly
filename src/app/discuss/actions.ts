'use server'

// Server actions for the discussion area. Everything that writes to the
// database lives here so the pages can stay mostly render-only. RLS still
// does the heavy lifting on authorisation - these functions just validate
// input, do a handful of sanity checks, and surface clean errors.

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCategory } from '@/lib/categories'
import { MAX_REPLY_DEPTH } from '@/lib/discuss'
import { runFilter, normaliseContent } from '@/lib/filters/filter'
import { FILTER_CONFIG } from '@/lib/filters/config'
import { RATING_CONFIG } from '@/lib/rating/config'

// Matches the check constraint in schema.sql. If you change one, change
// the other.
const MAX_TITLE = 200
const MAX_CONTENT = 20000

// --------------------------------------------------------------------------
// Phase 3: content filter helper
// --------------------------------------------------------------------------

// Runs the automatic filter against a new post body and returns the
// fields that should be merged into the `posts` insert, plus the list
// of reasons (if any) that can be persisted to the flags table.
//
// If the filter does not trip, returns hold_state: 'none' and an
// empty reason list - the caller should still spread these into the
// insert so the post always has well-defined hold columns.
async function computePostHold(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  rawContent: string
): Promise<{
  hold_state: 'none' | 'held'
  hold_reasons: string[] | null
  hold_expires_at: string | null
  filterReasons: string[]
}> {
  // Account age for the "new account, many links" rule.
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

  // Recent posts by the same author for duplicate detection.
  const windowMs = FILTER_CONFIG.duplicateWindowHours * 60 * 60 * 1000
  const since = new Date(Date.now() - windowMs).toISOString()
  const { data: recent } = await supabase
    .from('posts')
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

// Write one flag row per filter reason so the held post is visible in
// the held-post queue with its trigger list. Uses the caller's
// supabase client (subject to RLS): flags: insert own allows
// auto-flagging by the author as long as reporter_id matches auth.uid
// or is null. We leave reporter_id null and auto_flagged true so the
// row is clearly not a human report.
async function recordAutoFlags(
  supabase: Awaited<ReturnType<typeof createClient>>,
  postId: string,
  reasons: string[]
) {
  if (reasons.length === 0) return
  const rows = reasons.map((reason) => ({
    content_type: 'post' as const,
    content_id: postId,
    reason: `auto:${reason}`,
    auto_flagged: true,
    reporter_id: null,
  }))
  // Best effort - flag insertion failures should not block posting.
  await supabase.from('flags').insert(rows)
}

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

// --------------------------------------------------------------------------
// Threads
// --------------------------------------------------------------------------

export async function createThreadAction(formData: FormData) {
  const category = requireString(formData.get('category'), 'category').trim()
  const title = requireString(formData.get('title'), 'title').trim()
  const content = requireString(formData.get('content'), 'content').trim()

  if (!getCategory(category)) throw new Error('Unknown category.')
  if (title.length < 1 || title.length > MAX_TITLE)
    throw new Error(`Title must be 1-${MAX_TITLE} characters.`)
  if (content.length < 1 || content.length > MAX_CONTENT)
    throw new Error(`Body must be 1-${MAX_CONTENT} characters.`)

  const { supabase, user } = await requireUser()

  const { data: thread, error: threadErr } = await supabase
    .from('threads')
    .insert({ category, title, author_id: user.id })
    .select('id')
    .single()
  if (threadErr) throw new Error(threadErr.message)

  // Phase 3: run the automatic content filter.
  const hold = await computePostHold(supabase, user.id, content)

  const { data: insertedPost, error: postErr } = await supabase
    .from('posts')
    .insert({
      thread_id: thread.id,
      author_id: user.id,
      parent_post_id: null,
      content,
      hold_state: hold.hold_state,
      hold_reasons: hold.hold_reasons,
      hold_expires_at: hold.hold_expires_at,
    })
    .select('id')
    .single()
  if (postErr) {
    // Best-effort cleanup so we do not leave an empty thread behind.
    await supabase.from('threads').delete().eq('id', thread.id)
    throw new Error(postErr.message)
  }

  // Auto-flag rows for each filter reason so the held post shows up
  // in the review queue with context.
  if (hold.filterReasons.length > 0 && insertedPost) {
    await recordAutoFlags(supabase, insertedPost.id, hold.filterReasons)
  }

  revalidatePath(`/discuss/${category}`)
  redirect(`/discuss/${category}/${thread.id}`)
}

// --------------------------------------------------------------------------
// Replies
// --------------------------------------------------------------------------

// Walk up the parent chain to compute the depth of the given post. Returns
// 0 for a top-level post. Cheap for normal thread sizes; max depth is 5.
async function postDepth(
  supabase: Awaited<ReturnType<typeof createClient>>,
  postId: string
): Promise<number> {
  let depth = 0
  let current: string | null = postId
  while (current) {
    const result: { data: { parent_post_id: string | null } | null } =
      await supabase
        .from('posts')
        .select('parent_post_id')
        .eq('id', current)
        .maybeSingle()
    if (!result.data) break
    if (!result.data.parent_post_id) return depth
    current = result.data.parent_post_id
    depth++
    if (depth > MAX_REPLY_DEPTH + 2) break // safety
  }
  return depth
}

export async function createReplyAction(formData: FormData) {
  const threadId = requireString(formData.get('thread_id'), 'thread_id')
  const category = requireString(formData.get('category'), 'category')
  const parentRaw = formData.get('parent_post_id')
  const parentPostId =
    typeof parentRaw === 'string' && parentRaw.length > 0 ? parentRaw : null
  const content = requireString(formData.get('content'), 'content').trim()

  if (content.length < 1 || content.length > MAX_CONTENT)
    throw new Error(`Reply must be 1-${MAX_CONTENT} characters.`)

  const { supabase, user } = await requireUser()

  if (parentPostId) {
    const parentDepth = await postDepth(supabase, parentPostId)
    if (parentDepth >= MAX_REPLY_DEPTH) {
      throw new Error(
        `Replies can only be nested ${MAX_REPLY_DEPTH} levels deep.`
      )
    }
  }

  // Phase 3: run the automatic content filter on the reply body.
  const hold = await computePostHold(supabase, user.id, content)

  const { data: insertedPost, error } = await supabase
    .from('posts')
    .insert({
      thread_id: threadId,
      parent_post_id: parentPostId,
      author_id: user.id,
      content,
      hold_state: hold.hold_state,
      hold_reasons: hold.hold_reasons,
      hold_expires_at: hold.hold_expires_at,
    })
    .select('id')
    .single()
  if (error) {
    // RLS will fire here if the thread author has blocked this user.
    throw new Error(error.message)
  }

  if (hold.filterReasons.length > 0 && insertedPost) {
    await recordAutoFlags(supabase, insertedPost.id, hold.filterReasons)
  }

  // Bump the thread's updated_at so it floats to the top of "newest".
  await supabase
    .from('threads')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', threadId)

  revalidatePath(`/discuss/${category}/${threadId}`)
}

// --------------------------------------------------------------------------
// Edit / delete posts (author only; RLS enforces it too)
// --------------------------------------------------------------------------

export async function editPostAction(formData: FormData) {
  const postId = requireString(formData.get('post_id'), 'post_id')
  const threadId = requireString(formData.get('thread_id'), 'thread_id')
  const category = requireString(formData.get('category'), 'category')
  const content = requireString(formData.get('content'), 'content').trim()

  if (content.length < 1 || content.length > MAX_CONTENT)
    throw new Error(`Content must be 1-${MAX_CONTENT} characters.`)

  const { supabase } = await requireUser()

  const { error } = await supabase
    .from('posts')
    .update({ content, updated_at: new Date().toISOString() })
    .eq('id', postId)
  if (error) throw new Error(error.message)

  revalidatePath(`/discuss/${category}/${threadId}`)
}

export async function deletePostAction(formData: FormData) {
  const postId = requireString(formData.get('post_id'), 'post_id')
  const threadId = requireString(formData.get('thread_id'), 'thread_id')
  const category = requireString(formData.get('category'), 'category')

  const { supabase } = await requireUser()

  // If this is the top-level post of the thread, delete the whole thread.
  // Otherwise delete just the post. Note: deleting a post cascades to its
  // replies (ON DELETE CASCADE on posts.parent_post_id).
  const { data: post } = await supabase
    .from('posts')
    .select('parent_post_id, thread_id')
    .eq('id', postId)
    .maybeSingle()

  if (!post) throw new Error('Post not found.')

  if (post.parent_post_id === null) {
    const { error } = await supabase
      .from('threads')
      .delete()
      .eq('id', post.thread_id)
    if (error) throw new Error(error.message)
    revalidatePath(`/discuss/${category}`)
    redirect(`/discuss/${category}`)
  }

  const { error } = await supabase.from('posts').delete().eq('id', postId)
  if (error) throw new Error(error.message)

  revalidatePath(`/discuss/${category}/${threadId}`)
}

// --------------------------------------------------------------------------
// Mute / block
// --------------------------------------------------------------------------

export async function muteUserAction(formData: FormData) {
  const targetUserId = requireString(
    formData.get('target_user_id'),
    'target_user_id'
  )
  const redirectPath = requireString(formData.get('redirect_to'), 'redirect_to')

  const { supabase, user } = await requireUser()
  if (targetUserId === user.id) throw new Error('You cannot mute yourself.')

  const { error } = await supabase
    .from('mutes')
    .insert({ user_id: user.id, muted_user_id: targetUserId })
  if (error && !error.message.includes('duplicate')) throw new Error(error.message)

  revalidatePath(redirectPath)
}

export async function unmuteUserAction(formData: FormData) {
  const targetUserId = requireString(
    formData.get('target_user_id'),
    'target_user_id'
  )
  const redirectPath = requireString(formData.get('redirect_to'), 'redirect_to')

  const { supabase, user } = await requireUser()

  const { error } = await supabase
    .from('mutes')
    .delete()
    .eq('user_id', user.id)
    .eq('muted_user_id', targetUserId)
  if (error) throw new Error(error.message)

  revalidatePath(redirectPath)
}

export async function blockUserAction(formData: FormData) {
  const targetUserId = requireString(
    formData.get('target_user_id'),
    'target_user_id'
  )
  const redirectPath = requireString(formData.get('redirect_to'), 'redirect_to')

  const { supabase, user } = await requireUser()
  if (targetUserId === user.id) throw new Error('You cannot block yourself.')

  const { error } = await supabase
    .from('blocks')
    .insert({ user_id: user.id, blocked_user_id: targetUserId })
  if (error && !error.message.includes('duplicate')) throw new Error(error.message)

  revalidatePath(redirectPath)
}

export async function unblockUserAction(formData: FormData) {
  const targetUserId = requireString(
    formData.get('target_user_id'),
    'target_user_id'
  )
  const redirectPath = requireString(formData.get('redirect_to'), 'redirect_to')

  const { supabase, user } = await requireUser()

  const { error } = await supabase
    .from('blocks')
    .delete()
    .eq('user_id', user.id)
    .eq('blocked_user_id', targetUserId)
  if (error) throw new Error(error.message)

  revalidatePath(redirectPath)
}

// --------------------------------------------------------------------------
// Phase 3: cross-perspective rating
// --------------------------------------------------------------------------

// Records (or removes) the current user's helpful/unhelpful rating
// for a post. No raw counts or scores are ever returned - the only
// visible effect is whether the content is collapsed, and that
// decision is made by the cron job, not here.
//
// Values:
//   rating = 'helpful'    -> upsert helpful
//   rating = 'unhelpful'  -> upsert unhelpful
//   rating = ''           -> remove the user's rating
export async function rateAction(formData: FormData) {
  const postId = requireString(formData.get('post_id'), 'post_id')
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
      .eq('content_type', 'post')
      .eq('content_id', postId)
    if (error) throw new Error(error.message)
  } else if (rating === 'helpful' || rating === 'unhelpful') {
    const { error } = await supabase
      .from('ratings')
      .upsert(
        {
          user_id: user.id,
          content_type: 'post',
          content_id: postId,
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
// Phase 3: community flagging (user-initiated, not auto)
// --------------------------------------------------------------------------

// Lets any signed-in user report a post for human review. Flags are
// the mechanism by which a held post stays held after its 24-hour
// window expires - if a post has any flags in the window, the cron
// job refuses to auto-release it and an admin must decide.
export async function flagPostAction(formData: FormData) {
  const postId = requireString(formData.get('post_id'), 'post_id')
  const reason = (formData.get('reason') ?? '').toString().trim()
  const redirectPath = requireString(
    formData.get('redirect_to'),
    'redirect_to'
  )

  const { supabase, user } = await requireUser()

  const { error } = await supabase.from('flags').insert({
    content_type: 'post',
    content_id: postId,
    reason: reason.length > 0 ? reason : 'user_report',
    auto_flagged: false,
    reporter_id: user.id,
  })
  if (error) throw new Error(error.message)

  revalidatePath(redirectPath)
}
