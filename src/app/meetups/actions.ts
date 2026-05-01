'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { runFilter, normaliseContent } from '@/lib/filters/filter'
import { FILTER_CONFIG } from '@/lib/filters/config'
import { RATING_CONFIG } from '@/lib/rating/config'
import { MAX_REPLY_DEPTH } from '@/lib/discuss'

const MAX_CONTENT = 20000

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

async function requireOrganiser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  meetupId: string,
  userId: string
) {
  const { data: meetup } = await supabase
    .from('meetups')
    .select('organiser_id, status')
    .eq('id', meetupId)
    .maybeSingle<{ organiser_id: string; status: string }>()
  if (!meetup) throw new Error('Meetup not found.')
  if (meetup.organiser_id !== userId) throw new Error('Only the organiser can do this.')
  return meetup
}

// Runs the content filter and returns hold fields to merge into the insert.
async function computeMeetupPostHold(
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
      ? (Date.now() - new Date(userRow.created_at).getTime()) / (1000 * 60 * 60 * 24)
      : null

  const windowMs = FILTER_CONFIG.duplicateWindowHours * 60 * 60 * 1000
  const since = new Date(Date.now() - windowMs).toISOString()
  const { data: recent } = await supabase
    .from('meetup_posts')
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
    return { hold_state: 'none', hold_reasons: null, hold_expires_at: null, filterReasons: [] }
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

async function recordAutoFlagsMeetup(
  supabase: Awaited<ReturnType<typeof createClient>>,
  postId: string,
  reasons: string[]
) {
  if (reasons.length === 0) return
  const rows = reasons.map((reason) => ({
    content_type: 'meetup_post' as const,
    content_id: postId,
    reason: `auto:${reason}`,
    auto_flagged: true,
    reporter_id: null,
  }))
  await supabase.from('flags').insert(rows)
}

async function meetupPostDepth(
  supabase: Awaited<ReturnType<typeof createClient>>,
  postId: string
): Promise<number> {
  let depth = 0
  let current: string | null = postId
  while (current) {
    const result: { data: { parent_post_id: string | null } | null } = await supabase
      .from('meetup_posts')
      .select('parent_post_id')
      .eq('id', current)
      .maybeSingle()
    if (!result.data) break
    if (!result.data.parent_post_id) return depth
    current = result.data.parent_post_id
    depth++
    if (depth > MAX_REPLY_DEPTH + 2) break
  }
  return depth
}

// ---------------------------------------------------------------------------
// Meetup CRUD
// ---------------------------------------------------------------------------

export async function createMeetupAction(formData: FormData) {
  const { supabase, user } = await requireUser()

  const title = requireString(formData.get('title'), 'title').trim()
  const description = requireString(formData.get('description'), 'description').trim()
  const dateTimeRaw = requireString(formData.get('date_time'), 'date_time')
  const location = requireString(formData.get('location'), 'location').trim()
  const isOnline = formData.get('is_online') === 'true'
  const maxAttendeesRaw = formData.get('max_attendees')
  const maxAttendees =
    typeof maxAttendeesRaw === 'string' && maxAttendeesRaw.trim() !== ''
      ? parseInt(maxAttendeesRaw, 10)
      : null

  if (title.length < 1 || title.length > 200)
    throw new Error('Title must be 1–200 characters.')
  if (description.length < 1 || description.length > 5000)
    throw new Error('Description must be 1–5000 characters.')
  if (!dateTimeRaw) throw new Error('Date and time are required.')
  const dateTime = new Date(dateTimeRaw)
  if (isNaN(dateTime.getTime())) throw new Error('Invalid date and time.')
  if (location.length < 1 || location.length > 200)
    throw new Error('Location must be 1–200 characters.')
  if (maxAttendees !== null && (isNaN(maxAttendees) || maxAttendees < 1))
    throw new Error('Maximum attendees must be a positive number.')

  const { data: meetup, error: meetupErr } = await supabase
    .from('meetups')
    .insert({
      title,
      description,
      date_time: dateTime.toISOString(),
      location,
      is_online: isOnline,
      organiser_id: user.id,
      max_attendees: maxAttendees,
    })
    .select('id')
    .single()
  if (meetupErr) throw new Error(meetupErr.message)

  // Insert registration questions (if any).
  const questions: string[] = []
  for (let i = 0; i < 5; i++) {
    const q = formData.get(`question_${i}`)
    if (typeof q === 'string' && q.trim().length > 0) {
      questions.push(q.trim())
    }
  }
  if (questions.length > 0) {
    const questionRows = questions.map((question_text, idx) => ({
      meetup_id: meetup.id,
      question_text,
      display_order: idx,
    }))
    const { error: qErr } = await supabase.from('meetup_questions').insert(questionRows)
    if (qErr) throw new Error(qErr.message)
  }

  revalidatePath('/meetups')
  redirect(`/meetups/${meetup.id}`)
}

export async function editMeetupAction(formData: FormData) {
  const { supabase, user } = await requireUser()
  const meetupId = requireString(formData.get('meetup_id'), 'meetup_id')
  await requireOrganiser(supabase, meetupId, user.id)

  const title = requireString(formData.get('title'), 'title').trim()
  const description = requireString(formData.get('description'), 'description').trim()
  const dateTimeRaw = requireString(formData.get('date_time'), 'date_time')
  const location = requireString(formData.get('location'), 'location').trim()
  const isOnline = formData.get('is_online') === 'true'
  const maxAttendeesRaw = formData.get('max_attendees')
  const maxAttendees =
    typeof maxAttendeesRaw === 'string' && maxAttendeesRaw.trim() !== ''
      ? parseInt(maxAttendeesRaw, 10)
      : null

  if (title.length < 1 || title.length > 200) throw new Error('Title must be 1–200 characters.')
  if (description.length < 1 || description.length > 5000)
    throw new Error('Description must be 1–5000 characters.')
  const dateTime = new Date(dateTimeRaw)
  if (isNaN(dateTime.getTime())) throw new Error('Invalid date and time.')
  if (location.length < 1) throw new Error('Location is required.')

  const { error } = await supabase
    .from('meetups')
    .update({
      title,
      description,
      date_time: dateTime.toISOString(),
      location,
      is_online: isOnline,
      max_attendees: maxAttendees,
      updated_at: new Date().toISOString(),
    })
    .eq('id', meetupId)
  if (error) throw new Error(error.message)

  revalidatePath(`/meetups/${meetupId}`)
  revalidatePath(`/meetups/${meetupId}/manage`)
  redirect(`/meetups/${meetupId}/manage`)
}

export async function cancelMeetupAction(formData: FormData) {
  const { supabase, user } = await requireUser()
  const meetupId = requireString(formData.get('meetup_id'), 'meetup_id')
  await requireOrganiser(supabase, meetupId, user.id)

  const { error } = await supabase
    .from('meetups')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', meetupId)
  if (error) throw new Error(error.message)

  // Post a pinned cancellation announcement.
  await supabase.from('meetup_posts').insert({
    meetup_id: meetupId,
    author_id: user.id,
    parent_post_id: null,
    content: 'This meetup has been cancelled by the organiser.',
    is_pinned: true,
  })

  revalidatePath(`/meetups/${meetupId}`)
  revalidatePath(`/meetups/${meetupId}/manage`)
  redirect(`/meetups/${meetupId}/manage`)
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export async function registerForMeetupAction(formData: FormData) {
  const { supabase, user } = await requireUser()
  const meetupId = requireString(formData.get('meetup_id'), 'meetup_id')
  const asWaitlist = formData.get('waitlist') === 'true'

  // Insert registration row.
  const { data: reg, error: regErr } = await supabase
    .from('meetup_registrations')
    .insert({ meetup_id: meetupId, user_id: user.id, is_waitlist: asWaitlist })
    .select('id')
    .single()
  if (regErr) {
    // Duplicate key = already registered; silently redirect.
    if (!regErr.message.includes('duplicate') && !regErr.message.includes('unique'))
      throw new Error(regErr.message)
    revalidatePath(`/meetups/${meetupId}`)
    return
  }

  // Insert answers to any registration questions.
  const questions = formData.getAll('question_id') as string[]
  if (questions.length > 0) {
    const answerRows = questions
      .map((question_id, idx) => ({
        registration_id: reg.id,
        question_id,
        answer_text: ((formData.getAll('answer')[idx] as string) ?? '').slice(0, 500),
      }))
      .filter((r) => r.answer_text.trim().length > 0)
    if (answerRows.length > 0) {
      await supabase.from('meetup_answers').insert(answerRows)
    }
  }

  revalidatePath(`/meetups/${meetupId}`)
}

export async function unregisterFromMeetupAction(formData: FormData) {
  const { supabase, user } = await requireUser()
  const meetupId = requireString(formData.get('meetup_id'), 'meetup_id')

  const { error } = await supabase
    .from('meetup_registrations')
    .delete()
    .eq('meetup_id', meetupId)
    .eq('user_id', user.id)
  if (error) throw new Error(error.message)

  revalidatePath(`/meetups/${meetupId}`)
}

// ---------------------------------------------------------------------------
// Needs
// ---------------------------------------------------------------------------

export async function addNeedAction(formData: FormData) {
  const { supabase, user } = await requireUser()
  const meetupId = requireString(formData.get('meetup_id'), 'meetup_id')
  const description = requireString(formData.get('description'), 'description').trim()
  const estimatedCost = (formData.get('estimated_cost') as string | null)?.trim() || null

  if (description.length < 1 || description.length > 500)
    throw new Error('Description must be 1–500 characters.')

  const { error } = await supabase.from('meetup_needs').insert({
    meetup_id: meetupId,
    description,
    estimated_cost: estimatedCost || null,
    added_by: user.id,
  })
  if (error) throw new Error(error.message)

  revalidatePath(`/meetups/${meetupId}`)
  revalidatePath(`/meetups/${meetupId}/manage`)
}

export async function offerNeedAction(formData: FormData) {
  const { supabase, user } = await requireUser()
  const needId = requireString(formData.get('need_id'), 'need_id')
  const meetupId = requireString(formData.get('meetup_id'), 'meetup_id')

  const { error } = await supabase
    .from('meetup_needs')
    .update({ status: 'offered', offered_by: user.id, updated_at: new Date().toISOString() })
    .eq('id', needId)
    .eq('status', 'needed') // Only offer if still needed.
  if (error) throw new Error(error.message)

  revalidatePath(`/meetups/${meetupId}`)
  revalidatePath(`/meetups/${meetupId}/manage`)
}

export async function withdrawOfferAction(formData: FormData) {
  const { supabase, user } = await requireUser()
  const needId = requireString(formData.get('need_id'), 'need_id')
  const meetupId = requireString(formData.get('meetup_id'), 'meetup_id')

  const { error } = await supabase
    .from('meetup_needs')
    .update({ status: 'needed', offered_by: null, updated_at: new Date().toISOString() })
    .eq('id', needId)
    .eq('offered_by', user.id)
  if (error) throw new Error(error.message)

  revalidatePath(`/meetups/${meetupId}`)
  revalidatePath(`/meetups/${meetupId}/manage`)
}

export async function arrangeNeedAction(formData: FormData) {
  const { supabase, user } = await requireUser()
  const needId = requireString(formData.get('need_id'), 'need_id')
  const meetupId = requireString(formData.get('meetup_id'), 'meetup_id')
  await requireOrganiser(supabase, meetupId, user.id)

  const { error } = await supabase
    .from('meetup_needs')
    .update({ status: 'arranged', updated_at: new Date().toISOString() })
    .eq('id', needId)
  if (error) throw new Error(error.message)

  revalidatePath(`/meetups/${meetupId}`)
  revalidatePath(`/meetups/${meetupId}/manage`)
}

export async function deleteNeedAction(formData: FormData) {
  const { supabase, user } = await requireUser()
  const needId = requireString(formData.get('need_id'), 'need_id')
  const meetupId = requireString(formData.get('meetup_id'), 'meetup_id')

  // RLS enforces organiser-or-adder constraint.
  const { error } = await supabase.from('meetup_needs').delete().eq('id', needId)
  if (error) throw new Error(error.message)

  void user // suppress unused warning
  revalidatePath(`/meetups/${meetupId}`)
  revalidatePath(`/meetups/${meetupId}/manage`)
}

// ---------------------------------------------------------------------------
// Discussion posts
// ---------------------------------------------------------------------------

export async function createMeetupPostAction(formData: FormData) {
  const { supabase, user } = await requireUser()
  const meetupId = requireString(formData.get('meetup_id'), 'meetup_id')
  const content = requireString(formData.get('content'), 'content').trim()
  const isPinned = formData.get('is_pinned') === 'true'

  if (content.length < 1 || content.length > MAX_CONTENT)
    throw new Error(`Post must be 1–${MAX_CONTENT} characters.`)

  // Only organisers can pin posts.
  const finalPinned = isPinned
    ? (await requireOrganiser(supabase, meetupId, user.id)) !== null && isPinned
    : false

  const hold = await computeMeetupPostHold(supabase, user.id, content)

  const { data: inserted, error } = await supabase
    .from('meetup_posts')
    .insert({
      meetup_id: meetupId,
      author_id: user.id,
      parent_post_id: null,
      content,
      is_pinned: finalPinned,
      hold_state: hold.hold_state,
      hold_reasons: hold.hold_reasons,
      hold_expires_at: hold.hold_expires_at,
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)

  if (hold.filterReasons.length > 0 && inserted) {
    await recordAutoFlagsMeetup(supabase, inserted.id, hold.filterReasons)
  }

  revalidatePath(`/meetups/${meetupId}`)
}

export async function createMeetupReplyAction(formData: FormData) {
  const { supabase, user } = await requireUser()
  const meetupId = requireString(formData.get('meetup_id'), 'meetup_id')
  const parentRaw = formData.get('parent_post_id')
  const parentPostId =
    typeof parentRaw === 'string' && parentRaw.length > 0 ? parentRaw : null
  const content = requireString(formData.get('content'), 'content').trim()

  if (content.length < 1 || content.length > MAX_CONTENT)
    throw new Error(`Reply must be 1–${MAX_CONTENT} characters.`)

  if (parentPostId) {
    const parentDepth = await meetupPostDepth(supabase, parentPostId)
    if (parentDepth >= MAX_REPLY_DEPTH)
      throw new Error(`Replies can only be nested ${MAX_REPLY_DEPTH} levels deep.`)
  }

  const hold = await computeMeetupPostHold(supabase, user.id, content)

  const { data: inserted, error } = await supabase
    .from('meetup_posts')
    .insert({
      meetup_id: meetupId,
      parent_post_id: parentPostId,
      author_id: user.id,
      content,
      hold_state: hold.hold_state,
      hold_reasons: hold.hold_reasons,
      hold_expires_at: hold.hold_expires_at,
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)

  if (hold.filterReasons.length > 0 && inserted) {
    await recordAutoFlagsMeetup(supabase, inserted.id, hold.filterReasons)
  }

  revalidatePath(`/meetups/${meetupId}`)
}

export async function editMeetupPostAction(formData: FormData) {
  const { supabase } = await requireUser()
  const postId = requireString(formData.get('post_id'), 'post_id')
  const meetupId = requireString(formData.get('meetup_id'), 'meetup_id')
  const content = requireString(formData.get('content'), 'content').trim()

  if (content.length < 1 || content.length > MAX_CONTENT)
    throw new Error(`Content must be 1–${MAX_CONTENT} characters.`)

  const { error } = await supabase
    .from('meetup_posts')
    .update({ content, updated_at: new Date().toISOString() })
    .eq('id', postId)
  if (error) throw new Error(error.message)

  revalidatePath(`/meetups/${meetupId}`)
}

export async function deleteMeetupPostAction(formData: FormData) {
  const { supabase } = await requireUser()
  const postId = requireString(formData.get('post_id'), 'post_id')
  const meetupId = requireString(formData.get('meetup_id'), 'meetup_id')

  const { error } = await supabase.from('meetup_posts').delete().eq('id', postId)
  if (error) throw new Error(error.message)

  revalidatePath(`/meetups/${meetupId}`)
}

export async function flagMeetupPostAction(formData: FormData) {
  const { supabase, user } = await requireUser()
  const postId = requireString(formData.get('post_id'), 'post_id')
  const meetupId = requireString(formData.get('meetup_id'), 'meetup_id')
  const reason = (formData.get('reason') ?? '').toString().trim()

  const { error } = await supabase.from('flags').insert({
    content_type: 'meetup_post',
    content_id: postId,
    reason: reason.length > 0 ? reason : 'user_report',
    auto_flagged: false,
    reporter_id: user.id,
  })
  if (error) throw new Error(error.message)

  revalidatePath(`/meetups/${meetupId}`)
}

export async function rateMeetupPostAction(formData: FormData) {
  const { supabase, user } = await requireUser()
  const postId = requireString(formData.get('post_id'), 'post_id')
  const rating = formData.get('rating')
  const meetupId = requireString(formData.get('meetup_id'), 'meetup_id')

  if (rating === '' || rating === null) {
    const { error } = await supabase
      .from('ratings')
      .delete()
      .eq('user_id', user.id)
      .eq('content_type', 'meetup_post')
      .eq('content_id', postId)
    if (error) throw new Error(error.message)
  } else if (rating === 'helpful' || rating === 'unhelpful') {
    const { error } = await supabase
      .from('ratings')
      .upsert(
        { user_id: user.id, content_type: 'meetup_post', content_id: postId, rating },
        { onConflict: 'user_id,content_type,content_id' }
      )
    if (error) throw new Error(error.message)
  } else {
    throw new Error('Invalid rating value.')
  }

  revalidatePath(`/meetups/${meetupId}`)
}

// ---------------------------------------------------------------------------
// Organiser manage actions
// ---------------------------------------------------------------------------

export async function postOrganizerAnnouncementAction(formData: FormData) {
  const { supabase, user } = await requireUser()
  const meetupId = requireString(formData.get('meetup_id'), 'meetup_id')
  const content = requireString(formData.get('content'), 'content').trim()
  await requireOrganiser(supabase, meetupId, user.id)

  if (content.length < 1 || content.length > MAX_CONTENT)
    throw new Error('Announcement must be 1–20000 characters.')

  const { error } = await supabase.from('meetup_posts').insert({
    meetup_id: meetupId,
    author_id: user.id,
    parent_post_id: null,
    content,
    is_pinned: true,
  })
  if (error) throw new Error(error.message)

  revalidatePath(`/meetups/${meetupId}`)
  revalidatePath(`/meetups/${meetupId}/manage`)
}

export async function postDirectedMessageAction(formData: FormData) {
  const { supabase, user } = await requireUser()
  const meetupId = requireString(formData.get('meetup_id'), 'meetup_id')
  const targetUsername = requireString(formData.get('target_username'), 'target_username')
  const body = requireString(formData.get('content'), 'content').trim()
  await requireOrganiser(supabase, meetupId, user.id)

  const content = `@${targetUsername} — ${body}`
  if (content.length > MAX_CONTENT) throw new Error('Message too long.')

  const { error } = await supabase.from('meetup_posts').insert({
    meetup_id: meetupId,
    author_id: user.id,
    parent_post_id: null,
    content,
    is_pinned: false,
  })
  if (error) throw new Error(error.message)

  revalidatePath(`/meetups/${meetupId}`)
  revalidatePath(`/meetups/${meetupId}/manage`)
}
