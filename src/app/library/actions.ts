'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { randomUUID } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isAdminEmail } from '@/lib/admin'
import {
  getLibraryCategory,
  isValidPlatform,
  SOCIAL_MEDIA_VIDEOS_SLUG,
} from '@/lib/library-categories'
import { runFilter, normaliseContent } from '@/lib/filters/filter'
import { FILTER_CONFIG } from '@/lib/filters/config'
import { RATING_CONFIG } from '@/lib/rating/config'

// Matches the DB check constraint in schema.sql.
const MAX_TITLE = 300
// Spec limit: description capped at 500 chars in the UI (DB allows 2000).
const MAX_DESCRIPTION = 500
// Storage bucket name for hosted PDFs. Provisioned in phase9_migration.sql.
const PDF_BUCKET = 'library-pdfs'

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
//
// URL and pdf_path are each individually optional but at least one must
// be present (enforced both here and by the DB check constraint
// resources_link_or_pdf_check added in phase9_migration.sql). pdf_path
// is populated by the browser after a successful direct upload to
// Supabase Storage via getPdfUploadTargetAction below — the server
// action only receives the storage key, never the file bytes, so the
// Vercel Hobby 4.5 MB request body limit doesn't apply.

export async function submitResourceAction(formData: FormData) {
  const category = requireString(formData.get('category'), 'category').trim()
  const rawUrl = (formData.get('url') as string | null) ?? ''
  const url = rawUrl.trim()
  const rawPdfPath = (formData.get('pdf_path') as string | null) ?? ''
  const pdfPath = rawPdfPath.trim()
  const title = requireString(formData.get('title'), 'title').trim()
  const description = requireString(
    formData.get('description'),
    'description'
  ).trim()

  if (!getLibraryCategory(category)) throw new Error('Unknown category.')
  if (!url && !pdfPath) throw new Error('Provide a URL or upload a PDF.')
  if (url && !url.startsWith('http://') && !url.startsWith('https://'))
    throw new Error('URL must start with http:// or https://')
  if (title.length < 1 || title.length > MAX_TITLE)
    throw new Error(`Title must be 1–${MAX_TITLE} characters.`)
  if (description.length < 1 || description.length > MAX_DESCRIPTION)
    throw new Error(`Description must be 1–${MAX_DESCRIPTION} characters.`)

  // Platform is required only for social-media-videos, ignored elsewhere.
  let platform: string | null = null
  if (category === SOCIAL_MEDIA_VIDEOS_SLUG) {
    const rawPlatform = (formData.get('platform') as string | null)?.trim() ?? ''
    if (!isValidPlatform(rawPlatform))
      throw new Error('Please pick which platform this video is on.')
    if (!url) throw new Error('Provide a link to the video.')
    platform = rawPlatform
  }

  const { supabase, user } = await requireUser()

  // A pdf_path may only be supplied by an admin (matches the gating in
  // getPdfUploadTargetAction). Silently drop otherwise so a crafted
  // form POST can't attach an arbitrary storage key.
  const pdfPathToInsert =
    pdfPath && isAdminEmail(user.email) ? pdfPath : null

  if (pdfPathToInsert) {
    // Verify the file actually exists in the bucket. Prevents a partial
    // upload from becoming a broken resource.
    const service = createServiceClient()
    const { data: probe, error: probeErr } = await service.storage
      .from(PDF_BUCKET)
      .list('', { search: pdfPathToInsert })
    if (probeErr) throw new Error(probeErr.message)
    if (!probe || probe.length === 0)
      throw new Error('PDF upload not found in storage.')
  }

  const hold = await computeResourceHold(
    supabase,
    user.id,
    url || '',
    title,
    description
  )

  // Only include pdf_path in the payload when we actually have one so
  // that submissions still work if the phase9 migration hasn't been
  // applied yet (the column and the nullable url both come from there).
  const insertPayload: Record<string, unknown> = {
    category,
    title,
    description,
    submitter_id: user.id,
    hold_state: hold.hold_state,
    hold_reasons: hold.hold_reasons,
    hold_expires_at: hold.hold_expires_at,
  }
  if (pdfPathToInsert) {
    insertPayload.pdf_path = pdfPathToInsert
    if (url) insertPayload.url = url
  } else {
    insertPayload.url = url
  }
  if (platform) {
    insertPayload.platform = platform
  }

  const { data: inserted, error } = await supabase
    .from('resources')
    .insert(insertPayload)
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
// Signed upload target for library PDFs (admin-only)
// --------------------------------------------------------------------------
//
// Returns a storage path and a signed upload URL that the browser can
// PUT the PDF to directly. The URL is short-lived and single-use. The
// admin check is here (server-side), not in a storage RLS policy, so
// keys don't need to be baked into SQL when the admin list changes.

export async function getPdfUploadTargetAction(): Promise<{
  path: string
  token: string
}> {
  const { user } = await requireUser()
  if (!isAdminEmail(user.email))
    throw new Error('Only admins can upload PDFs at the moment.')

  const service = createServiceClient()
  const path = `${randomUUID()}.pdf`
  const { data, error } = await service.storage
    .from(PDF_BUCKET)
    .createSignedUploadUrl(path)
  if (error) throw new Error(error.message)
  return { path, token: data.token }
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
// Delete a resource
// --------------------------------------------------------------------------

// Submitters and admins can delete a resource. RLS covers the
// submitter case at the DB level; the admin case is done via the
// service client so admins can clean up duplicates and spam without
// being the original submitter.
export async function deleteResourceAction(formData: FormData) {
  const resourceId = requireString(formData.get('resource_id'), 'resource_id')
  const category = requireString(formData.get('category'), 'category')

  const { supabase, user } = await requireUser()

  const { data: resource } = await supabase
    .from('resources')
    .select('submitter_id, pdf_path')
    .eq('id', resourceId)
    .maybeSingle<{ submitter_id: string; pdf_path: string | null }>()
  if (!resource) throw new Error('Resource not found.')

  const isSubmitter = resource.submitter_id === user.id
  const isAdmin = isAdminEmail(user.email)
  if (!isSubmitter && !isAdmin) {
    throw new Error('Only the submitter or an admin can delete this.')
  }

  if (isAdmin && !isSubmitter) {
    const service = createServiceClient()
    if (resource.pdf_path) {
      await service.storage.from(PDF_BUCKET).remove([resource.pdf_path])
    }
    const { error } = await service
      .from('resources')
      .delete()
      .eq('id', resourceId)
    if (error) throw new Error(error.message)
  } else {
    if (resource.pdf_path) {
      const service = createServiceClient()
      await service.storage.from(PDF_BUCKET).remove([resource.pdf_path])
    }
    const { error } = await supabase
      .from('resources')
      .delete()
      .eq('id', resourceId)
    if (error) throw new Error(error.message)
  }

  revalidatePath(`/library/${category}`)
  redirect(`/library/${category}`)
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
