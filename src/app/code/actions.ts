'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isAdminEmail } from '@/lib/admin'
import {
  slugifyCipher,
  findFreeCipherSlug,
  CIPHER_SLUG_MIN,
  CIPHER_SLUG_MAX,
  CIPHER_SLUG_PATTERN,
} from '@/lib/code-slug'

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
  if (!isAdminEmail(user.email)) throw new Error('Admins only.')
  return { supabase, user }
}

export async function submitCipherAction(formData: FormData) {
  const { supabase, user } = await requireUser()

  const title = requireString(formData.get('title'), 'title').trim()
  const summary = requireString(formData.get('summary'), 'summary').trim()
  const cipherText = requireString(formData.get('cipher_text'), 'cipher_text').trim()
  const decodedReading = requireString(formData.get('decoded_reading'), 'decoded_reading').trim()
  const method = requireString(formData.get('method'), 'method').trim()
  const sourcesRaw = (formData.get('sources') as string | null)?.trim() ?? ''
  const sources = sourcesRaw.length > 0 ? sourcesRaw : null
  const slugRaw = (formData.get('slug') as string | null)?.trim() ?? ''

  if (title.length < 1 || title.length > 200)
    throw new Error('Title must be 1-200 characters.')
  if (summary.length < 1 || summary.length > 500)
    throw new Error('Summary must be 1-500 characters.')
  if (cipherText.length < 1 || cipherText.length > 2000)
    throw new Error('Cipher text must be 1-2000 characters.')
  if (decodedReading.length < 1 || decodedReading.length > 5000)
    throw new Error('Decoded reading must be 1-5000 characters.')
  if (method.length < 1 || method.length > 20000)
    throw new Error('Method write-up must be 1-20000 characters.')
  if (sources !== null && sources.length > 5000)
    throw new Error('Sources must be at most 5000 characters.')

  let base: string | null
  if (slugRaw.length > 0) {
    base = slugifyCipher(slugRaw)
    if (base === null || !CIPHER_SLUG_PATTERN.test(base) || base.length > CIPHER_SLUG_MAX)
      throw new Error(
        `Slug must be ${CIPHER_SLUG_MIN}-${CIPHER_SLUG_MAX} letters, numbers and dashes.`
      )
  } else {
    base = slugifyCipher(title)
    if (base === null) base = 'cipher'
  }
  const slug = await findFreeCipherSlug(supabase, base)

  const { error } = await supabase.from('code_ciphers').insert({
    slug,
    title,
    summary,
    cipher_text: cipherText,
    decoded_reading: decodedReading,
    method,
    sources,
    submitter_id: user.id,
    status: 'pending',
  })
  if (error) throw new Error(error.message)

  revalidatePath('/code')
  revalidatePath('/review')
  redirect('/code?submitted=1')
}

export async function approveCipherAction(formData: FormData) {
  await requireAdmin()
  const service = createServiceClient()
  const cipherId = requireString(formData.get('cipher_id'), 'cipher_id')
  const animationSlugRaw = (formData.get('animation_slug') as string | null)?.trim() ?? ''
  const animationSlug = animationSlugRaw.length > 0 ? animationSlugRaw : null

  if (animationSlug !== null && !CIPHER_SLUG_PATTERN.test(animationSlug))
    throw new Error('Animation slug must be lowercase letters, numbers and dashes.')

  const { error } = await service
    .from('code_ciphers')
    .update({
      status: 'published',
      animation_slug: animationSlug,
      reviewed_by: (await requireUser()).user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', cipherId)
  if (error) throw new Error(error.message)

  revalidatePath('/code')
  revalidatePath('/review')
}

export async function rejectCipherAction(formData: FormData) {
  const { user } = await requireAdmin()
  const service = createServiceClient()
  const cipherId = requireString(formData.get('cipher_id'), 'cipher_id')

  const { error } = await service
    .from('code_ciphers')
    .update({
      status: 'rejected',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', cipherId)
  if (error) throw new Error(error.message)

  revalidatePath('/code')
  revalidatePath('/review')
}

export async function updateCipherAnimationSlugAction(formData: FormData) {
  await requireAdmin()
  const service = createServiceClient()
  const cipherId = requireString(formData.get('cipher_id'), 'cipher_id')
  const raw = (formData.get('animation_slug') as string | null)?.trim() ?? ''
  const animationSlug = raw.length > 0 ? raw : null

  if (animationSlug !== null && !CIPHER_SLUG_PATTERN.test(animationSlug))
    throw new Error('Animation slug must be lowercase letters, numbers and dashes.')

  const { error } = await service
    .from('code_ciphers')
    .update({ animation_slug: animationSlug, updated_at: new Date().toISOString() })
    .eq('id', cipherId)
  if (error) throw new Error(error.message)

  revalidatePath('/code')
  revalidatePath('/review')
}
