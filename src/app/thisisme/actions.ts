'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { detectEmbed } from '@/lib/media-embeds'

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
// Entries
// ---------------------------------------------------------------------------

export async function addTextEntryAction(formData: FormData) {
  const { supabase, user } = await requireUser()
  const content = requireString(formData.get('content'), 'content').trim()
  const username = requireString(formData.get('username'), 'username')
  if (content.length < 1 || content.length > 20000)
    throw new Error('Text must be 1-20000 characters.')

  const { error } = await supabase.from('this_is_me_entries').insert({
    user_id: user.id,
    entry_type: 'text',
    content,
  })
  if (error) throw new Error(error.message)
  revalidatePath(`/thisisme/${username}`)
  revalidatePath('/thisisme')
}

// Photo entries store the storage-path in media_url. Client uploads the
// file via the browser Supabase client before calling this action.
export async function addPhotoEntryAction(formData: FormData) {
  const { supabase, user } = await requireUser()
  const mediaUrl = requireString(formData.get('media_url'), 'media_url').trim()
  const caption = (formData.get('content') as string | null)?.trim() ?? ''
  const username = requireString(formData.get('username'), 'username')
  if (!mediaUrl.startsWith(`${user.id}/`))
    throw new Error('Photo path must live in your own folder.')
  if (caption.length > 20000) throw new Error('Caption too long.')

  const { error } = await supabase.from('this_is_me_entries').insert({
    user_id: user.id,
    entry_type: 'photo',
    content: caption.length > 0 ? caption : null,
    media_url: mediaUrl,
  })
  if (error) throw new Error(error.message)
  revalidatePath(`/thisisme/${username}`)
  revalidatePath('/thisisme')
}

export async function addVideoEntryAction(formData: FormData) {
  const { supabase, user } = await requireUser()
  const url = requireString(formData.get('media_url'), 'media_url').trim()
  const caption = (formData.get('content') as string | null)?.trim() ?? ''
  const username = requireString(formData.get('username'), 'username')
  const embed = detectEmbed(url)
  if (!embed)
    throw new Error(
      'That video URL is not recognised. YouTube, TikTok and Vimeo links work.'
    )
  if (caption.length > 20000) throw new Error('Caption too long.')

  const { error } = await supabase.from('this_is_me_entries').insert({
    user_id: user.id,
    entry_type: 'video',
    content: caption.length > 0 ? caption : null,
    media_url: url,
  })
  if (error) throw new Error(error.message)
  revalidatePath(`/thisisme/${username}`)
  revalidatePath('/thisisme')
}

export async function deleteEntryAction(formData: FormData) {
  const { supabase, user } = await requireUser()
  const entryId = requireString(formData.get('entry_id'), 'entry_id')
  const username = requireString(formData.get('username'), 'username')

  // If this is a photo, try to delete the storage object too. Not
  // strictly required (bucket is public and orphaned files just sit
  // there), but tidy.
  const { data: row } = await supabase
    .from('this_is_me_entries')
    .select('entry_type, media_url')
    .eq('id', entryId)
    .maybeSingle<{ entry_type: string; media_url: string | null }>()
  if (row?.entry_type === 'photo' && row.media_url) {
    await supabase.storage.from('this-is-me-photos').remove([row.media_url])
  }

  const { error } = await supabase
    .from('this_is_me_entries')
    .delete()
    .eq('id', entryId)
  if (error) throw new Error(error.message)
  revalidatePath(`/thisisme/${username}`)
  revalidatePath('/thisisme')
}

export async function editEntryTextAction(formData: FormData) {
  const { supabase, user } = await requireUser()
  const entryId = requireString(formData.get('entry_id'), 'entry_id')
  const username = requireString(formData.get('username'), 'username')
  const content = requireString(formData.get('content'), 'content').trim()
  if (content.length > 20000) throw new Error('Content too long.')

  const { error } = await supabase
    .from('this_is_me_entries')
    .update({ content, updated_at: new Date().toISOString() })
    .eq('id', entryId)
  if (error) throw new Error(error.message)
  revalidatePath(`/thisisme/${username}`)
}

export async function toggleCommentsEnabledAction(formData: FormData) {
  const { supabase, user } = await requireUser()
  const entryId = requireString(formData.get('entry_id'), 'entry_id')
  const username = requireString(formData.get('username'), 'username')
  const enabled = formData.get('enabled') === 'true'

  const { error } = await supabase
    .from('this_is_me_entries')
    .update({ comments_enabled: enabled, updated_at: new Date().toISOString() })
    .eq('id', entryId)
  if (error) throw new Error(error.message)
  revalidatePath(`/thisisme/${username}`)
}

// ---------------------------------------------------------------------------
// Loves
// ---------------------------------------------------------------------------

export async function toggleLoveAction(formData: FormData) {
  const { supabase, user } = await requireUser()
  const entryId = requireString(formData.get('entry_id'), 'entry_id')
  const username = requireString(formData.get('username'), 'username')
  const loved = formData.get('loved') === 'true'

  if (loved) {
    // User is un-loving.
    await supabase
      .from('this_is_me_loves')
      .delete()
      .eq('entry_id', entryId)
      .eq('user_id', user.id)
  } else {
    const { error } = await supabase
      .from('this_is_me_loves')
      .insert({ entry_id: entryId, user_id: user.id })
    if (error && !error.message.includes('duplicate') && !error.message.includes('unique'))
      throw new Error(error.message)
  }
  revalidatePath(`/thisisme/${username}`)
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export async function addCommentAction(formData: FormData) {
  const { supabase, user } = await requireUser()
  const entryId = requireString(formData.get('entry_id'), 'entry_id')
  const username = requireString(formData.get('username'), 'username')
  const content = requireString(formData.get('content'), 'content').trim()
  if (content.length < 1 || content.length > 10000)
    throw new Error('Comment must be 1-10000 characters.')

  const { error } = await supabase
    .from('this_is_me_comments')
    .insert({ entry_id: entryId, author_id: user.id, content })
  if (error) throw new Error(error.message)
  revalidatePath(`/thisisme/${username}`)
}

export async function deleteCommentAction(formData: FormData) {
  const { supabase } = await requireUser()
  const commentId = requireString(formData.get('comment_id'), 'comment_id')
  const username = requireString(formData.get('username'), 'username')

  const { error } = await supabase
    .from('this_is_me_comments')
    .delete()
    .eq('id', commentId)
  if (error) throw new Error(error.message)
  revalidatePath(`/thisisme/${username}`)
}
