'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdminEmail } from '@/lib/admin'
import { runFilter, normaliseContent } from '@/lib/filters/filter'
import { FILTER_CONFIG } from '@/lib/filters/config'
import { RATING_CONFIG } from '@/lib/rating/config'
import { MAX_REPLY_DEPTH } from '@/lib/discuss'
import { isValidCategory } from '@/lib/user-projects/categories'
import { parseLinksFromFormData } from '@/lib/user-projects/links'
import { findRecentDuplicate } from '@/lib/dedupe'
import { sendBadgePush } from '@/lib/push/server'

const MAX_CONTENT = 20000
const MAX_VISION = 200000
const MAX_MODEL = 200000
const MAX_UPDATE = 50000

const VALID_AVAILABILITY = new Set([
  'weekends',
  'weekdays',
  'both',
  'flexible',
  'relocate',
])

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

async function requireAdmin() {
  const { supabase, user } = await requireUser()
  if (!isAdminEmail(user.email)) {
    throw new Error('Only the site admin can do this.')
  }
  return { supabase, user }
}

async function requireProjectCreator(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  userId: string
) {
  const { data: project } = await supabase
    .from('projects')
    .select('creator_id, status')
    .eq('id', projectId)
    .maybeSingle<{ creator_id: string; status: string }>()
  if (!project) throw new Error('Project not found.')
  if (project.creator_id !== userId)
    throw new Error('Only the project creator can do this.')
  return project
}

// Runs the content filter and returns hold fields to merge into the insert.
async function computeProjectPostHold(
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
    .from('project_posts')
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

async function recordAutoFlagsProject(
  supabase: Awaited<ReturnType<typeof createClient>>,
  postId: string,
  reasons: string[]
) {
  if (reasons.length === 0) return
  const rows = reasons.map((reason) => ({
    content_type: 'project_post' as const,
    content_id: postId,
    reason: `auto:${reason}`,
    auto_flagged: true,
    reporter_id: null,
  }))
  await supabase.from('flags').insert(rows)
}

async function projectPostDepth(
  supabase: Awaited<ReturnType<typeof createClient>>,
  postId: string
): Promise<number> {
  let depth = 0
  let current: string | null = postId
  while (current) {
    const result: { data: { parent_post_id: string | null } | null } =
      await supabase
        .from('project_posts')
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
// Project CRUD (admin only)
// ---------------------------------------------------------------------------

type TierInput = {
  name: string
  upfront: number
  monthly: number
  months: number
  total: number
  slots: number
  phaseChoice: boolean
}

function parseTierInputs(formData: FormData): TierInput[] {
  const tiers: TierInput[] = []
  for (let i = 0; i < 20; i++) {
    const name = (formData.get(`tier_name_${i}`) as string | null)?.trim()
    if (!name) continue
    const upfront = parseFloat((formData.get(`tier_upfront_${i}`) as string) ?? '0')
    const monthly = parseFloat((formData.get(`tier_monthly_${i}`) as string) ?? '0')
    const months = parseInt((formData.get(`tier_months_${i}`) as string) ?? '0', 10)
    const slots = parseInt((formData.get(`tier_slots_${i}`) as string) ?? '0', 10)
    const phaseChoice = formData.get(`tier_phase_choice_${i}`) === 'true'
    if (
      !Number.isFinite(upfront) ||
      upfront < 0 ||
      !Number.isFinite(monthly) ||
      monthly < 0 ||
      !Number.isFinite(months) ||
      months < 0 ||
      !Number.isFinite(slots) ||
      slots <= 0
    ) {
      throw new Error(`Tier "${name}" has invalid numeric values.`)
    }
    const total = upfront + monthly * months
    tiers.push({ name, upfront, monthly, months, total, slots, phaseChoice })
  }
  if (tiers.length === 0) {
    throw new Error('At least one tier is required.')
  }
  return tiers
}

export async function createProjectAction(formData: FormData) {
  const { supabase, user } = await requireAdmin()

  const title = requireString(formData.get('title'), 'title').trim()
  const shortDescription = requireString(
    formData.get('short_description'),
    'short_description'
  ).trim()
  const visionContent = requireString(
    formData.get('vision_content'),
    'vision_content'
  )
  const modelContent = requireString(
    formData.get('model_content'),
    'model_content'
  )
  const pdfUrlRaw = (formData.get('pdf_url') as string | null)?.trim() ?? ''
  const pdfUrl = pdfUrlRaw.length > 0 ? pdfUrlRaw : null
  const fundingTargetRaw = (formData.get('funding_target') as string | null) ?? ''
  const perPersonTargetRaw =
    (formData.get('per_person_target') as string | null) ?? ''

  if (title.length < 1 || title.length > 200)
    throw new Error('Title must be 1–200 characters.')
  if (shortDescription.length < 1 || shortDescription.length > 500)
    throw new Error('Short description must be 1–500 characters.')
  if (visionContent.length < 1 || visionContent.length > MAX_VISION)
    throw new Error('Vision content is required.')
  if (modelContent.length < 1 || modelContent.length > MAX_MODEL)
    throw new Error('Model content is required.')

  const fundingTarget =
    fundingTargetRaw.trim().length > 0 ? parseFloat(fundingTargetRaw) : 25800000
  const perPersonTarget =
    perPersonTargetRaw.trim().length > 0
      ? parseFloat(perPersonTargetRaw)
      : 8600

  if (!Number.isFinite(fundingTarget) || fundingTarget < 0)
    throw new Error('Invalid funding target.')
  if (!Number.isFinite(perPersonTarget) || perPersonTarget < 0)
    throw new Error('Invalid per-person target.')

  const tiers = parseTierInputs(formData)

  const { data: project, error: projErr } = await supabase
    .from('projects')
    .insert({
      title,
      short_description: shortDescription,
      vision_content: visionContent,
      model_content: modelContent,
      pdf_url: pdfUrl,
      creator_id: user.id,
      funding_target: fundingTarget,
      per_person_target: perPersonTarget,
    })
    .select('id')
    .single()
  if (projErr) throw new Error(projErr.message)

  const tierRows = tiers.map((t, idx) => ({
    project_id: project.id,
    name: t.name,
    upfront_amount: t.upfront,
    monthly_amount: t.monthly,
    monthly_duration_months: t.months,
    total_amount: t.total,
    target_slots: t.slots,
    phase_choice: t.phaseChoice,
    display_order: idx,
  }))
  const { error: tierErr } = await supabase
    .from('project_tiers')
    .insert(tierRows)
  if (tierErr) throw new Error(tierErr.message)

  revalidatePath('/projects')
  redirect(`/projects/${project.id}`)
}

export async function editProjectVisionAction(formData: FormData) {
  const { supabase, user } = await requireUser()
  const projectId = requireString(formData.get('project_id'), 'project_id')
  await requireProjectCreator(supabase, projectId, user.id)

  const visionContent = requireString(
    formData.get('vision_content'),
    'vision_content'
  )
  const pdfUrlRaw = (formData.get('pdf_url') as string | null)?.trim() ?? ''
  const pdfUrl = pdfUrlRaw.length > 0 ? pdfUrlRaw : null

  if (visionContent.length < 1 || visionContent.length > MAX_VISION)
    throw new Error('Vision content is required.')

  const { error } = await supabase
    .from('projects')
    .update({
      vision_content: visionContent,
      pdf_url: pdfUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId)
  if (error) throw new Error(error.message)

  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/projects/${projectId}/manage`)
}

export async function editProjectModelAction(formData: FormData) {
  const { supabase, user } = await requireUser()
  const projectId = requireString(formData.get('project_id'), 'project_id')
  await requireProjectCreator(supabase, projectId, user.id)

  const modelContent = requireString(
    formData.get('model_content'),
    'model_content'
  )
  if (modelContent.length < 1 || modelContent.length > MAX_MODEL)
    throw new Error('Model content is required.')

  const { error } = await supabase
    .from('projects')
    .update({
      model_content: modelContent,
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId)
  if (error) throw new Error(error.message)

  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/projects/${projectId}/manage`)
}

// ---------------------------------------------------------------------------
// Registration of interest
// ---------------------------------------------------------------------------

export async function registerInterestAction(formData: FormData) {
  const { supabase, user } = await requireUser()
  const projectId = requireString(formData.get('project_id'), 'project_id')
  const tierId = requireString(formData.get('tier_id'), 'tier_id')
  const skills = ((formData.get('skills_text') as string) ?? '').slice(0, 500)
  const location = ((formData.get('location_text') as string) ?? '').slice(0, 200)
  const motivation = ((formData.get('motivation_text') as string) ?? '').slice(0, 500)
  const availability = (formData.get('availability') as string) ?? ''

  if (!VALID_AVAILABILITY.has(availability))
    throw new Error('Please select an availability.')

  // Verify the tier belongs to this project.
  const { data: tier } = await supabase
    .from('project_tiers')
    .select('id, project_id')
    .eq('id', tierId)
    .maybeSingle<{ id: string; project_id: string }>()
  if (!tier || tier.project_id !== projectId)
    throw new Error('Selected tier does not belong to this project.')

  // Upsert by (project_id, user_id) so re-submitting updates the existing row.
  const { error } = await supabase
    .from('project_registrations')
    .upsert(
      {
        project_id: projectId,
        user_id: user.id,
        tier_id: tierId,
        skills_text: skills,
        location_text: location,
        motivation_text: motivation,
        availability,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'project_id,user_id' }
    )
  if (error) throw new Error(error.message)

  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/projects/${projectId}/manage`)
}

export async function withdrawInterestAction(formData: FormData) {
  const { supabase, user } = await requireUser()
  const projectId = requireString(formData.get('project_id'), 'project_id')

  const { error } = await supabase
    .from('project_registrations')
    .delete()
    .eq('project_id', projectId)
    .eq('user_id', user.id)
  if (error) throw new Error(error.message)

  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/projects/${projectId}/manage`)
}

// ---------------------------------------------------------------------------
// Progress updates
// ---------------------------------------------------------------------------

export async function postProjectUpdateAction(formData: FormData) {
  const { supabase, user } = await requireUser()
  const projectId = requireString(formData.get('project_id'), 'project_id')
  await requireProjectCreator(supabase, projectId, user.id)

  const title = requireString(formData.get('title'), 'title').trim()
  const content = requireString(formData.get('content'), 'content').trim()

  if (title.length < 1 || title.length > 200)
    throw new Error('Title must be 1–200 characters.')
  if (content.length < 1 || content.length > MAX_UPDATE)
    throw new Error(`Update must be 1–${MAX_UPDATE} characters.`)

  const { error } = await supabase.from('project_updates').insert({
    project_id: projectId,
    title,
    content,
    author_id: user.id,
  })
  if (error) throw new Error(error.message)

  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/projects/${projectId}/manage`)
}

export async function deleteProjectUpdateAction(formData: FormData) {
  const { supabase, user } = await requireUser()
  const projectId = requireString(formData.get('project_id'), 'project_id')
  const updateId = requireString(formData.get('update_id'), 'update_id')
  await requireProjectCreator(supabase, projectId, user.id)

  const { error } = await supabase
    .from('project_updates')
    .delete()
    .eq('id', updateId)
  if (error) throw new Error(error.message)

  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/projects/${projectId}/manage`)
}

// ---------------------------------------------------------------------------
// Discussion posts (project_posts)
// ---------------------------------------------------------------------------

export async function createProjectPostAction(formData: FormData) {
  const { supabase, user } = await requireUser()
  const projectId = requireString(formData.get('project_id'), 'project_id')
  const content = requireString(formData.get('content'), 'content').trim()
  const updateIdRaw = formData.get('update_id')
  const updateId =
    typeof updateIdRaw === 'string' && updateIdRaw.length > 0
      ? updateIdRaw
      : null

  if (content.length < 1 || content.length > MAX_CONTENT)
    throw new Error(`Post must be 1–${MAX_CONTENT} characters.`)

  {
    const existingId = await findRecentDuplicate(supabase, {
      table: 'project_posts',
      userColumn: 'author_id',
      userId: user.id,
      match: {
        project_id: projectId,
        update_id: updateId,
        parent_post_id: null,
        content,
      },
    })
    if (existingId) {
      revalidatePath(`/projects/${projectId}`)
      return
    }
  }

  const hold = await computeProjectPostHold(supabase, user.id, content)

  const { data: inserted, error } = await supabase
    .from('project_posts')
    .insert({
      project_id: projectId,
      update_id: updateId,
      author_id: user.id,
      parent_post_id: null,
      content,
      hold_state: hold.hold_state,
      hold_reasons: hold.hold_reasons,
      hold_expires_at: hold.hold_expires_at,
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)

  if (hold.filterReasons.length > 0 && inserted) {
    await recordAutoFlagsProject(supabase, inserted.id, hold.filterReasons)
  }

  revalidatePath(`/projects/${projectId}`)
}

export async function createProjectReplyAction(formData: FormData) {
  const { supabase, user } = await requireUser()
  const projectId = requireString(formData.get('project_id'), 'project_id')
  const parentRaw = formData.get('parent_post_id')
  const parentPostId =
    typeof parentRaw === 'string' && parentRaw.length > 0 ? parentRaw : null
  const content = requireString(formData.get('content'), 'content').trim()

  if (content.length < 1 || content.length > MAX_CONTENT)
    throw new Error(`Reply must be 1–${MAX_CONTENT} characters.`)

  let updateId: string | null = null
  if (parentPostId) {
    const parentDepth = await projectPostDepth(supabase, parentPostId)
    if (parentDepth >= MAX_REPLY_DEPTH)
      throw new Error(
        `Replies can only be nested ${MAX_REPLY_DEPTH} levels deep.`
      )
    // Inherit update_id from the parent so child replies stay in the
    // same update thread or in the main discussion.
    const { data: parent } = await supabase
      .from('project_posts')
      .select('update_id')
      .eq('id', parentPostId)
      .maybeSingle<{ update_id: string | null }>()
    updateId = parent?.update_id ?? null
  }

  {
    const existingId = await findRecentDuplicate(supabase, {
      table: 'project_posts',
      userColumn: 'author_id',
      userId: user.id,
      match: {
        project_id: projectId,
        parent_post_id: parentPostId,
        content,
      },
    })
    if (existingId) {
      revalidatePath(`/projects/${projectId}`)
      return
    }
  }

  const hold = await computeProjectPostHold(supabase, user.id, content)

  const { data: inserted, error } = await supabase
    .from('project_posts')
    .insert({
      project_id: projectId,
      update_id: updateId,
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
    await recordAutoFlagsProject(supabase, inserted.id, hold.filterReasons)
  }

  // Silent push to the parent post author so their PWA icon lights up.
  if (parentPostId) {
    try {
      const { data: parent } = await supabase
        .from('project_posts')
        .select('author_id')
        .eq('id', parentPostId)
        .maybeSingle<{ author_id: string }>()
      if (parent?.author_id && parent.author_id !== user.id) {
        await sendBadgePush(parent.author_id)
      }
    } catch {
      // ignore
    }
  }

  revalidatePath(`/projects/${projectId}`)
}

export async function editProjectPostAction(formData: FormData) {
  const { supabase } = await requireUser()
  const postId = requireString(formData.get('post_id'), 'post_id')
  const projectId = requireString(formData.get('project_id'), 'project_id')
  const content = requireString(formData.get('content'), 'content').trim()

  if (content.length < 1 || content.length > MAX_CONTENT)
    throw new Error(`Content must be 1–${MAX_CONTENT} characters.`)

  const { error } = await supabase
    .from('project_posts')
    .update({ content, updated_at: new Date().toISOString() })
    .eq('id', postId)
  if (error) throw new Error(error.message)

  revalidatePath(`/projects/${projectId}`)
}

export async function deleteProjectPostAction(formData: FormData) {
  const { supabase } = await requireUser()
  const postId = requireString(formData.get('post_id'), 'post_id')
  const projectId = requireString(formData.get('project_id'), 'project_id')

  const { error } = await supabase
    .from('project_posts')
    .delete()
    .eq('id', postId)
  if (error) throw new Error(error.message)

  revalidatePath(`/projects/${projectId}`)
}

export async function flagProjectPostAction(formData: FormData) {
  const { supabase, user } = await requireUser()
  const postId = requireString(formData.get('post_id'), 'post_id')
  const projectId = requireString(formData.get('project_id'), 'project_id')
  const reason = (formData.get('reason') ?? '').toString().trim()

  const { error } = await supabase.from('flags').insert({
    content_type: 'project_post',
    content_id: postId,
    reason: reason.length > 0 ? reason : 'user_report',
    auto_flagged: false,
    reporter_id: user.id,
  })
  if (error) throw new Error(error.message)

  revalidatePath(`/projects/${projectId}`)
}

// ---------------------------------------------------------------------------
// User projects (lightweight, any signed-in user)
// ---------------------------------------------------------------------------

const USER_PROJECT_MAX_DESCRIPTION = 50000

async function requireUserProjectCreator(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userProjectId: string,
  userId: string
) {
  const { data: project } = await supabase
    .from('user_projects')
    .select('creator_id')
    .eq('id', userProjectId)
    .maybeSingle<{ creator_id: string }>()
  if (!project) throw new Error('Project not found.')
  if (project.creator_id !== userId)
    throw new Error('Only the project creator can do this.')
}

export async function createUserProjectAction(formData: FormData) {
  const { supabase, user } = await requireUser()

  const title = requireString(formData.get('title'), 'title').trim()
  const shortDescription = requireString(
    formData.get('short_description'),
    'short_description'
  ).trim()
  const description = requireString(
    formData.get('description'),
    'description'
  ).trim()
  const category = requireString(formData.get('category'), 'category').trim()

  if (title.length < 1 || title.length > 200)
    throw new Error('Title must be 1–200 characters.')
  if (shortDescription.length < 1 || shortDescription.length > 500)
    throw new Error('Short description must be 1–500 characters.')
  if (
    description.length < 1 ||
    description.length > USER_PROJECT_MAX_DESCRIPTION
  )
    throw new Error(
      `Description must be 1–${USER_PROJECT_MAX_DESCRIPTION} characters.`
    )
  if (!isValidCategory(category))
    throw new Error('Please choose a category.')

  const links = parseLinksFromFormData(formData)

  // Short-window duplicate guard: same creator + same title in the
  // last ~45s is treated as a double-click.
  {
    const existingId = await findRecentDuplicate(supabase, {
      table: 'user_projects',
      userColumn: 'creator_id',
      userId: user.id,
      match: { title },
    })
    if (existingId) {
      revalidatePath('/projects')
      redirect(`/projects/u/${existingId}`)
    }
  }

  const { data: project, error } = await supabase
    .from('user_projects')
    .insert({
      creator_id: user.id,
      title,
      short_description: shortDescription,
      description,
      category,
      links,
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)

  revalidatePath('/projects')
  redirect(`/projects/u/${project.id}`)
}

export async function editUserProjectAction(formData: FormData) {
  const { supabase, user } = await requireUser()
  const projectId = requireString(formData.get('project_id'), 'project_id')
  await requireUserProjectCreator(supabase, projectId, user.id)

  const title = requireString(formData.get('title'), 'title').trim()
  const shortDescription = requireString(
    formData.get('short_description'),
    'short_description'
  ).trim()
  const description = requireString(
    formData.get('description'),
    'description'
  ).trim()
  const category = requireString(formData.get('category'), 'category').trim()

  if (title.length < 1 || title.length > 200)
    throw new Error('Title must be 1–200 characters.')
  if (shortDescription.length < 1 || shortDescription.length > 500)
    throw new Error('Short description must be 1–500 characters.')
  if (
    description.length < 1 ||
    description.length > USER_PROJECT_MAX_DESCRIPTION
  )
    throw new Error(
      `Description must be 1–${USER_PROJECT_MAX_DESCRIPTION} characters.`
    )
  if (!isValidCategory(category))
    throw new Error('Please choose a category.')

  const links = parseLinksFromFormData(formData)

  const { error } = await supabase
    .from('user_projects')
    .update({
      title,
      short_description: shortDescription,
      description,
      category,
      links,
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId)
  if (error) throw new Error(error.message)

  revalidatePath('/projects')
  revalidatePath(`/projects/u/${projectId}`)
}

export async function deleteUserProjectAction(formData: FormData) {
  const { supabase, user } = await requireUser()
  const projectId = requireString(formData.get('project_id'), 'project_id')
  await requireUserProjectCreator(supabase, projectId, user.id)

  const { error } = await supabase
    .from('user_projects')
    .delete()
    .eq('id', projectId)
  if (error) throw new Error(error.message)

  revalidatePath('/projects')
  redirect('/projects')
}

// ---------------------------------------------------------------------------

export async function rateProjectPostAction(formData: FormData) {
  const { supabase, user } = await requireUser()
  const postId = requireString(formData.get('post_id'), 'post_id')
  const rating = formData.get('rating')
  const projectId = requireString(formData.get('project_id'), 'project_id')

  if (rating === '' || rating === null) {
    const { error } = await supabase
      .from('ratings')
      .delete()
      .eq('user_id', user.id)
      .eq('content_type', 'project_post')
      .eq('content_id', postId)
    if (error) throw new Error(error.message)
  } else if (rating === 'helpful' || rating === 'unhelpful') {
    const { error } = await supabase.from('ratings').upsert(
      {
        user_id: user.id,
        content_type: 'project_post',
        content_id: postId,
        rating,
      },
      { onConflict: 'user_id,content_type,content_id' }
    )
    if (error) throw new Error(error.message)
  } else {
    throw new Error('Invalid rating value.')
  }

  revalidatePath(`/projects/${projectId}`)
}
