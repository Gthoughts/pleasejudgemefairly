'use server'

// Admin server actions for the video moderation queues on /review.
//
// Two queues live here:
//
//   1. Taxonomy queue.  New user-created video_categories and
//      video_subcategories land as status='pending_review' but are
//      live immediately. Admin can:
//        - keep    (flip status to 'active')
//        - rename  (edit name + slug, flip to 'active')
//        - merge   (move all videos to a target category/subcategory
//                   then set status='merged', merged_into=target)
//        - reject  (set status='rejected', unpublish any videos using
//                   it, DM the creator via admin_messages)
//
//   2. Reports queue.  video_reports.status starts as 'pending'.
//      Admin sets the verdict; the handle_video_report_verdict
//      trigger in phase19_videos.sql applies the side effects
//      (unpublish for confirmed, restore + warn for warning,
//      restore + revoke privilege for permanent_ban).
//      This action also writes an admin_message to the reporter
//      explaining warning / ban, and to the uploader on confirmed.
//
// All writes use the service-role client because we cross RLS
// boundaries (writing to other users' rows, admin_messages).

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isAdminEmail } from '@/lib/admin'
import {
  slugifyCategoryName,
  normaliseCategoryName,
} from '@/lib/videos/categories'
import {
  REPORT_STATUSES,
  type ReportStatus,
} from '@/lib/videos/reports'

function requireString(value: FormDataEntryValue | null, field: string): string {
  if (typeof value !== 'string') throw new Error(`Missing ${field}`)
  return value
}

function optionalString(value: FormDataEntryValue | null): string | null {
  if (typeof value !== 'string') return null
  const t = value.trim()
  return t.length === 0 ? null : t
}

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('You must be signed in.')
  if (!isAdminEmail(user.email)) throw new Error('Admin only.')
  return { user, service: createServiceClient() }
}

// ------------------------------------------------------------------
// Category admin actions
// ------------------------------------------------------------------

export async function keepVideoCategoryAction(formData: FormData) {
  const categoryId = requireString(formData.get('category_id'), 'category_id')
  const { service } = await requireAdmin()
  const { error } = await service
    .from('video_categories')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('id', categoryId)
    .eq('status', 'pending_review')
  if (error) throw new Error(error.message)
  revalidatePath('/review')
}

export async function renameVideoCategoryAction(formData: FormData) {
  const categoryId = requireString(formData.get('category_id'), 'category_id')
  const rawName = requireString(formData.get('name'), 'name')
  const name = normaliseCategoryName(rawName)
  if (name.length === 0) throw new Error('Name is required.')
  const slug = slugifyCategoryName(name)
  if (slug.length === 0) throw new Error('Name must contain letters or numbers.')
  const { service } = await requireAdmin()
  const { error } = await service
    .from('video_categories')
    .update({
      name,
      slug,
      status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('id', categoryId)
  if (error) {
    if (error.code === '23505')
      throw new Error('That slug is already in use by another category.')
    throw new Error(error.message)
  }
  revalidatePath('/review')
}

// Merge source category into target category. Every video whose
// category_id = source gets reassigned to target and its
// subcategory_id cleared (target may have a different subcategory
// tree). Source category is marked merged with merged_into = target.
export async function mergeVideoCategoryAction(formData: FormData) {
  const sourceId = requireString(formData.get('source_id'), 'source_id')
  const targetId = requireString(formData.get('target_id'), 'target_id')
  if (sourceId === targetId) throw new Error('Cannot merge a category into itself.')
  const { service } = await requireAdmin()

  const { error: updErr } = await service
    .from('videos')
    .update({ category_id: targetId, subcategory_id: null })
    .eq('category_id', sourceId)
  if (updErr) throw new Error(updErr.message)

  const { error: markErr } = await service
    .from('video_categories')
    .update({
      status: 'merged',
      merged_into: targetId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sourceId)
  if (markErr) throw new Error(markErr.message)

  revalidatePath('/review')
  revalidatePath('/videos')
}

// Reject a category. Any videos using it are unpublished with a
// reason. Creator gets an admin_message explaining the decision.
export async function rejectVideoCategoryAction(formData: FormData) {
  const categoryId = requireString(formData.get('category_id'), 'category_id')
  const reason = optionalString(formData.get('reason'))
  const { service } = await requireAdmin()

  const { data: cat } = await service
    .from('video_categories')
    .select('id, name, created_by')
    .eq('id', categoryId)
    .maybeSingle<{ id: string; name: string; created_by: string | null }>()
  if (!cat) throw new Error('Category not found.')

  // Unpublish any videos still tagged with this category.
  await service
    .from('videos')
    .update({
      is_unpublished: true,
      unpublished_reason: 'category_rejected',
    })
    .eq('category_id', categoryId)

  // Mark the category rejected.
  const { error: markErr } = await service
    .from('video_categories')
    .update({
      status: 'rejected',
      updated_at: new Date().toISOString(),
    })
    .eq('id', categoryId)
  if (markErr) throw new Error(markErr.message)

  // Notify the creator so they know why and can resubmit under a
  // valid category.
  if (cat.created_by) {
    await service.from('admin_messages').insert({
      recipient_id: cat.created_by,
      subject: `Category "${cat.name}" was not accepted`,
      body:
        'The category you suggested was not accepted for public use, so any videos filed under it have been unpublished. ' +
        'You can re-tag your videos under one of the existing categories. ' +
        (reason ? `Admin note: ${reason}` : ''),
      related_category_id: cat.id,
    })
  }

  revalidatePath('/review')
  revalidatePath('/videos')
}

// ------------------------------------------------------------------
// Subcategory admin actions (mirror of the category ones)
// ------------------------------------------------------------------

export async function keepVideoSubcategoryAction(formData: FormData) {
  const id = requireString(formData.get('subcategory_id'), 'subcategory_id')
  const { service } = await requireAdmin()
  const { error } = await service
    .from('video_subcategories')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending_review')
  if (error) throw new Error(error.message)
  revalidatePath('/review')
}

export async function renameVideoSubcategoryAction(formData: FormData) {
  const id = requireString(formData.get('subcategory_id'), 'subcategory_id')
  const rawName = requireString(formData.get('name'), 'name')
  const name = normaliseCategoryName(rawName)
  if (name.length === 0) throw new Error('Name is required.')
  const slug = slugifyCategoryName(name)
  if (slug.length === 0) throw new Error('Name must contain letters or numbers.')
  const { service } = await requireAdmin()
  const { error } = await service
    .from('video_subcategories')
    .update({
      name,
      slug,
      status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) {
    if (error.code === '23505')
      throw new Error('That slug is already used inside this category.')
    throw new Error(error.message)
  }
  revalidatePath('/review')
}

export async function mergeVideoSubcategoryAction(formData: FormData) {
  const sourceId = requireString(formData.get('source_id'), 'source_id')
  const targetId = requireString(formData.get('target_id'), 'target_id')
  if (sourceId === targetId) throw new Error('Cannot merge a subcategory into itself.')
  const { service } = await requireAdmin()

  // Target must be in the same parent category so we don't shuffle
  // videos across categories accidentally.
  const { data: source } = await service
    .from('video_subcategories')
    .select('id, category_id')
    .eq('id', sourceId)
    .maybeSingle<{ id: string; category_id: string }>()
  const { data: target } = await service
    .from('video_subcategories')
    .select('id, category_id')
    .eq('id', targetId)
    .maybeSingle<{ id: string; category_id: string }>()
  if (!source || !target) throw new Error('Source or target not found.')
  if (source.category_id !== target.category_id)
    throw new Error('Target subcategory must be in the same parent category.')

  await service
    .from('videos')
    .update({ subcategory_id: targetId })
    .eq('subcategory_id', sourceId)

  const { error } = await service
    .from('video_subcategories')
    .update({
      status: 'merged',
      merged_into: targetId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sourceId)
  if (error) throw new Error(error.message)

  revalidatePath('/review')
  revalidatePath('/videos')
}

export async function rejectVideoSubcategoryAction(formData: FormData) {
  const id = requireString(formData.get('subcategory_id'), 'subcategory_id')
  const reason = optionalString(formData.get('reason'))
  const { service } = await requireAdmin()

  const { data: sub } = await service
    .from('video_subcategories')
    .select('id, name, created_by')
    .eq('id', id)
    .maybeSingle<{ id: string; name: string; created_by: string | null }>()
  if (!sub) throw new Error('Subcategory not found.')

  // Clear subcategory_id from videos rather than unpublishing.
  // A rejected subcategory is less severe: the category still fits,
  // the tag was just a bad label.
  await service
    .from('videos')
    .update({ subcategory_id: null })
    .eq('subcategory_id', id)

  const { error } = await service
    .from('video_subcategories')
    .update({
      status: 'rejected',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw new Error(error.message)

  if (sub.created_by) {
    await service.from('admin_messages').insert({
      recipient_id: sub.created_by,
      subject: `Subcategory "${sub.name}" was not accepted`,
      body:
        'The subcategory you suggested was not accepted for public use. ' +
        'Videos previously filed under it now show no subcategory; ' +
        'you can re-tag them from your video edit page. ' +
        (reason ? `Admin note: ${reason}` : ''),
      related_subcategory_id: sub.id,
    })
  }

  revalidatePath('/review')
  revalidatePath('/videos')
}

// ------------------------------------------------------------------
// Report verdict actions
//
// Each just flips video_reports.status; the DB trigger applies the
// side effects (unpublish video / increment warnings / revoke).
// The action layer also writes admin_messages so the reporter and
// (for confirmed) the uploader know what happened.
// ------------------------------------------------------------------

async function setReportVerdict(
  reportId: string,
  verdict: ReportStatus,
  adminNote: string | null
) {
  if (verdict === 'pending')
    throw new Error('Cannot set verdict back to pending.')
  if (!(REPORT_STATUSES as readonly string[]).includes(verdict))
    throw new Error('Invalid verdict.')

  const { user, service } = await requireAdmin()

  // Load the report so we know who reported what, and which video,
  // so the admin_message can reference it.
  const { data: report } = await service
    .from('video_reports')
    .select('id, video_id, reporter_id, status')
    .eq('id', reportId)
    .maybeSingle<{
      id: string
      video_id: string
      reporter_id: string
      status: ReportStatus
    }>()
  if (!report) throw new Error('Report not found.')
  if (report.status !== 'pending')
    throw new Error('This report has already been decided.')

  const { error } = await service
    .from('video_reports')
    .update({
      status: verdict,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', reportId)
  if (error) throw new Error(error.message)

  // Look up the uploader for confirmed messages.
  const { data: video } = await service
    .from('videos')
    .select('id, title, uploader_id')
    .eq('id', report.video_id)
    .maybeSingle<{ id: string; title: string; uploader_id: string }>()

  // Reporter-facing message for warning / permanent_ban.
  if (verdict === 'warning' && report.reporter_id) {
    await service.from('admin_messages').insert({
      recipient_id: report.reporter_id,
      subject: 'A video you reported was not taken down',
      body:
        'Thanks for looking out for the community. We reviewed the video ' +
        'you reported and it did not need to come down. ' +
        'This is a warning, not a ban. Three warnings in total will remove your ability to report videos. ' +
        (adminNote ? `Admin note: ${adminNote}` : ''),
      related_video_id: report.video_id,
    })
  } else if (verdict === 'permanent_ban' && report.reporter_id) {
    await service.from('admin_messages').insert({
      recipient_id: report.reporter_id,
      subject: 'Your ability to report videos has been removed',
      body:
        'A video you reported did not need to come down and the report looked to be in bad faith. ' +
        'Your ability to report videos has been removed permanently. Every other part of the site works as normal. ' +
        (adminNote ? `Admin note: ${adminNote}` : ''),
      related_video_id: report.video_id,
    })
  } else if (verdict === 'confirmed' && video && video.uploader_id) {
    await service.from('admin_messages').insert({
      recipient_id: video.uploader_id,
      subject: `Your video was taken down`,
      body:
        `A video you added ("${video.title}") was reported and, after review, has been taken down. ` +
        (adminNote ? `Admin note: ${adminNote}` : ''),
      related_video_id: report.video_id,
    })
  }

  revalidatePath('/review')
  revalidatePath('/videos')
  revalidatePath(`/videos/${report.video_id}`)
}

export async function confirmVideoReportAction(formData: FormData) {
  const reportId = requireString(formData.get('report_id'), 'report_id')
  const note = optionalString(formData.get('note'))
  await setReportVerdict(reportId, 'confirmed', note)
}

export async function warnVideoReportAction(formData: FormData) {
  const reportId = requireString(formData.get('report_id'), 'report_id')
  const note = optionalString(formData.get('note'))
  await setReportVerdict(reportId, 'warning', note)
}

export async function permanentBanVideoReportAction(formData: FormData) {
  const reportId = requireString(formData.get('report_id'), 'report_id')
  const note = optionalString(formData.get('note'))
  await setReportVerdict(reportId, 'permanent_ban', note)
}
