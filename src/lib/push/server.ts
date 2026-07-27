import 'server-only'
import webpush from 'web-push'
import { createServiceClient } from '@/lib/supabase/service'

// Send a silent push to every subscription attached to `userId` so the
// PWA icon on their phone updates its unread-count badge. The service
// worker (public/sw.js) receives the push and calls setAppBadge — no
// visible notification is displayed. If a subscription is stale
// (410 Gone), it is removed from the DB.

let configured = false

function configureWebPush() {
  if (configured) return
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com'
  if (!publicKey || !privateKey) {
    throw new Error(
      'Push not configured: set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.'
    )
  }
  webpush.setVapidDetails(subject, publicKey, privateKey)
  configured = true
}

type Subscription = {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

// Best-effort. Never throws to the caller — a failed push should not
// break the calling server action (creating a reply must always succeed).
export async function sendBadgePush(userId: string): Promise<void> {
  try {
    if (!process.env.VAPID_PRIVATE_KEY) return
    configureWebPush()

    const service = createServiceClient()

    const [{ data: subs }, { data: countRaw }] = await Promise.all([
      service
        .from('push_subscriptions')
        .select('id, endpoint, p256dh, auth')
        .eq('user_id', userId)
        .returns<Subscription[]>(),
      service.rpc('inbox_unread_count_for', { p_user_id: userId }),
    ])

    if (!subs || subs.length === 0) return

    const count = typeof countRaw === 'number' ? countRaw : Number(countRaw ?? 0)
    const payload = JSON.stringify({ badge: count })

    const staleEndpoints: string[] = []

    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload,
            { TTL: 60 * 60, urgency: 'low' }
          )
        } catch (err) {
          const status =
            typeof err === 'object' && err !== null && 'statusCode' in err
              ? (err as { statusCode: number }).statusCode
              : 0
          if (status === 404 || status === 410) {
            staleEndpoints.push(sub.endpoint)
          }
        }
      })
    )

    if (staleEndpoints.length > 0) {
      await service
        .from('push_subscriptions')
        .delete()
        .in('endpoint', staleEndpoints)
    }
  } catch {
    // Swallow — pushes are best-effort.
  }
}
