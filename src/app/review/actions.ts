'use server'

// Server actions for the held-post/resource review queue.
//
// Most of the held workflow runs without human input: the filter trips,
// the content is held for 24 hours with a visible banner, the community
// rates and flags, and the cron job releases or retains based on flag
// activity. The actions in here are only needed for early admin release
// and broken-link confirmation.

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isAdminEmail } from '@/lib/admin'

function requireString(
  value: FormDataEntryValue | null,
  field: string
): string {
  if (typeof value !== 'string') throw new Error(`Missing ${field}`)
  return value
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

// --------------------------------------------------------------------------
// Release a held post early (admin only)
// --------------------------------------------------------------------------

export async function releaseHeldPostAdminAction(formData: FormData) {
  const postId = requireString(formData.get('post_id'), 'post_id')
  const { user, service } = await requireAdmin()

  const { error } = await service
    .from('posts')
    .update({
      hold_state: 'released',
      released_at: new Date().toISOString(),
      released_by: 'admin',
    })
    .eq('id', postId)
    .eq('hold_state', 'held')
  if (error) throw new Error(error.message)

  await service.from('collapse_log').insert({
    post_id: postId,
    event: 'released',
    reason: 'admin_release',
    details: { admin_email: user.email },
  })

  revalidatePath('/review')
}

// --------------------------------------------------------------------------
// Release a held resource early (admin only)
// --------------------------------------------------------------------------

export async function releaseHeldResourceAdminAction(formData: FormData) {
  const resourceId = requireString(formData.get('resource_id'), 'resource_id')
  const { user, service } = await requireAdmin()

  const { error } = await service
    .from('resources')
    .update({
      hold_state: 'released',
      released_at: new Date().toISOString(),
      released_by: 'admin',
    })
    .eq('id', resourceId)
    .eq('hold_state', 'held')
  if (error) throw new Error(error.message)

  await service.from('collapse_log').insert({
    resource_id: resourceId,
    event: 'released',
    reason: 'admin_release',
    details: { admin_email: user.email },
  })

  revalidatePath('/review')
}

// --------------------------------------------------------------------------
// Confirm broken link status (admin only)
// --------------------------------------------------------------------------

// Admin can mark a resource as confirmed broken (true) or confirmed
// working (false). Setting broken_confirmed=false clears a false
// positive — the "may be broken" banner disappears even if the flag
// count is ≥ 3.
export async function confirmBrokenLinkAction(formData: FormData) {
  const resourceId = requireString(formData.get('resource_id'), 'resource_id')
  const confirmed = formData.get('confirmed') === 'true'
  const { service } = await requireAdmin()

  const { error } = await service
    .from('resources')
    .update({ broken_confirmed: confirmed })
    .eq('id', resourceId)
  if (error) throw new Error(error.message)

  revalidatePath('/review')
}
