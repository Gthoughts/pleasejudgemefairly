'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const MAX_DATES = 12

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

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createHelpOutAction(formData: FormData) {
  const { supabase, user } = await requireUser()

  const title = requireString(formData.get('title'), 'title').trim()
  const description = requireString(formData.get('description'), 'description').trim()
  const area = requireString(formData.get('area'), 'area').trim()

  if (title.length < 1 || title.length > 200)
    throw new Error('Title must be 1 to 200 characters.')
  if (description.length < 1 || description.length > 5000)
    throw new Error('Description must be 1 to 5000 characters.')
  if (area.length < 1 || area.length > 120)
    throw new Error('General area must be 1 to 120 characters.')

  // Already-uploaded public URLs supplied by the client.
  const photoUrls = (formData.getAll('photo_url') as string[])
    .map((u) => (typeof u === 'string' ? u.trim() : ''))
    .filter((u) => u.length > 0)

  // ISO yyyy-mm-dd date strings. At least one, deduped, capped at MAX_DATES.
  const rawDates = (formData.getAll('date') as string[])
    .map((d) => (typeof d === 'string' ? d.trim() : ''))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
  const dates = Array.from(new Set(rawDates)).slice(0, MAX_DATES)
  if (dates.length < 1) throw new Error('Please offer at least one possible date.')

  const { data: helpOut, error: helpOutErr } = await supabase
    .from('help_outs')
    .insert({
      requester_id: user.id,
      title,
      description,
      area,
      photo_urls: photoUrls,
      status: 'open',
    })
    .select('id')
    .single()
  if (helpOutErr) throw new Error(helpOutErr.message)

  const dateRows = dates.map((the_date, idx) => ({
    help_out_id: helpOut.id,
    the_date,
    display_order: idx,
  }))
  const { error: dateErr } = await supabase.from('help_out_dates').insert(dateRows)
  if (dateErr) throw new Error(dateErr.message)

  revalidatePath('/helpouts')
  redirect(`/helpouts/${helpOut.id}`)
}

// ---------------------------------------------------------------------------
// Volunteering
// ---------------------------------------------------------------------------

// A member can help on multiple dates. We replace this user's set of
// volunteer rows for the help_out: delete the existing ones, then insert
// the newly chosen date_ids.
export async function volunteerAction(formData: FormData) {
  const { supabase, user } = await requireUser()
  const helpOutId = requireString(formData.get('help_out_id'), 'help_out_id')
  const dateIds = (formData.getAll('date_id') as string[])
    .map((d) => (typeof d === 'string' ? d.trim() : ''))
    .filter((d) => d.length > 0)

  // Clear any previous offers by this user on this help_out.
  const { error: delErr } = await supabase
    .from('help_out_volunteers')
    .delete()
    .eq('help_out_id', helpOutId)
    .eq('user_id', user.id)
  if (delErr) throw new Error(delErr.message)

  if (dateIds.length > 0) {
    const rows = Array.from(new Set(dateIds)).map((date_id) => ({
      help_out_id: helpOutId,
      date_id,
      user_id: user.id,
    }))
    const { error: insErr } = await supabase.from('help_out_volunteers').insert(rows)
    if (insErr) throw new Error(insErr.message)
  }

  revalidatePath(`/helpouts/${helpOutId}`)
  revalidatePath('/helpouts')
}

export async function withdrawAction(formData: FormData) {
  const { supabase, user } = await requireUser()
  const helpOutId = requireString(formData.get('help_out_id'), 'help_out_id')

  const { error } = await supabase
    .from('help_out_volunteers')
    .delete()
    .eq('help_out_id', helpOutId)
    .eq('user_id', user.id)
  if (error) throw new Error(error.message)

  revalidatePath(`/helpouts/${helpOutId}`)
  revalidatePath('/helpouts')
}

// ---------------------------------------------------------------------------
// Requester controls
// ---------------------------------------------------------------------------

export async function markSortedAction(formData: FormData) {
  const { supabase, user } = await requireUser()
  const helpOutId = requireString(formData.get('help_out_id'), 'help_out_id')

  const { error } = await supabase
    .from('help_outs')
    .update({ status: 'sorted', updated_at: new Date().toISOString() })
    .eq('id', helpOutId)
    .eq('requester_id', user.id)
  if (error) throw new Error(error.message)

  revalidatePath(`/helpouts/${helpOutId}`)
  revalidatePath('/helpouts')
}

export async function deleteHelpOutAction(formData: FormData) {
  const { supabase, user } = await requireUser()
  const helpOutId = requireString(formData.get('help_out_id'), 'help_out_id')

  const { error } = await supabase
    .from('help_outs')
    .delete()
    .eq('id', helpOutId)
    .eq('requester_id', user.id)
  if (error) throw new Error(error.message)

  revalidatePath('/helpouts')
  redirect('/helpouts')
}
