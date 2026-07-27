'use server'

import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'

type IncomingSubscription = {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

// Save (or update) a Web Push subscription for the signed-in user.
// Called from the browser after the user grants notification
// permission and the service worker successfully subscribes. Uses
// upsert-by-endpoint so re-registering the same browser is idempotent.
export async function saveSubscriptionAction(
  subscription: IncomingSubscription
) {
  if (
    !subscription ||
    typeof subscription.endpoint !== 'string' ||
    !subscription.keys ||
    typeof subscription.keys.p256dh !== 'string' ||
    typeof subscription.keys.auth !== 'string'
  ) {
    throw new Error('Invalid subscription payload.')
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('You must be signed in.')

  const h = await headers()
  const userAgent = h.get('user-agent') ?? null

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      user_agent: userAgent,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' }
  )
  if (error) throw new Error(error.message)
}

export async function removeSubscriptionAction(endpoint: string) {
  if (typeof endpoint !== 'string' || endpoint.length === 0) return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint)
    .eq('user_id', user.id)
}
