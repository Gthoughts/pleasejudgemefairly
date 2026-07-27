'use client'

import { useEffect, useState } from 'react'
import {
  saveSubscriptionAction,
  removeSubscriptionAction,
} from '@/app/actions/push'

// Renders on every page but only shows anything if the user is signed
// in, the browser can do push, and they have not already made a
// permission choice. Prompts once, unobtrusively, at the bottom of
// the viewport with a short explanation of why we ask for the
// notification permission (spoiler: we never send push notifications
// — we only use it to keep the home-screen icon badge in sync).

type State =
  | { kind: 'idle' }
  | { kind: 'prompt' }
  | { kind: 'subscribing' }
  | { kind: 'error'; message: string }
  | { kind: 'done' }
  | { kind: 'dismissed' }
  | { kind: 'unsupported' }

const DISMISS_KEY = 'apfy_badge_prompt_dismissed_v1'

function toB64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

export default function PushBadgeSetup({
  signedIn,
  unreadCount,
}: {
  signedIn: boolean
  unreadCount: number
}) {
  const [state, setState] = useState<State>({ kind: 'idle' })

  // Sync the OS badge with the actual inbox count on every page load.
  // If the user has zero unread, this clears any stale badge left over
  // from an earlier push; if they have some, it corrects the count.
  useEffect(() => {
    if (typeof navigator === 'undefined') return
    const nav = navigator as Navigator & {
      setAppBadge?: (n?: number) => Promise<void>
      clearAppBadge?: () => Promise<void>
    }
    if (unreadCount > 0 && typeof nav.setAppBadge === 'function') {
      nav.setAppBadge(unreadCount).catch(() => {})
    } else if (typeof nav.clearAppBadge === 'function') {
      nav.clearAppBadge().catch(() => {})
    }
  }, [unreadCount])

  useEffect(() => {
    if (!signedIn) return
    let cancelled = false

    async function init() {
      if (
        typeof window === 'undefined' ||
        !('serviceWorker' in navigator) ||
        !('PushManager' in window) ||
        !('Notification' in window)
      ) {
        setState({ kind: 'unsupported' })
        return
      }

      try {
        const reg = await navigator.serviceWorker.register('/sw.js')

        const existing = await reg.pushManager.getSubscription()
        const permission = Notification.permission

        if (permission === 'granted' && existing) {
          // Already set up; nothing to prompt for.
          setState({ kind: 'done' })
          return
        }

        if (permission === 'denied') {
          setState({ kind: 'dismissed' })
          return
        }

        if (
          typeof localStorage !== 'undefined' &&
          localStorage.getItem(DISMISS_KEY) === '1'
        ) {
          setState({ kind: 'dismissed' })
          return
        }

        if (!cancelled) setState({ kind: 'prompt' })
      } catch (err) {
        if (!cancelled) {
          setState({
            kind: 'error',
            message: err instanceof Error ? err.message : String(err),
          })
        }
      }
    }

    init()
    return () => {
      cancelled = true
    }
  }, [signedIn])

  async function enable() {
    setState({ kind: 'subscribing' })
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        try {
          localStorage.setItem(DISMISS_KEY, '1')
        } catch {
          // ignore
        }
        setState({ kind: 'dismissed' })
        return
      }

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!publicKey) {
        setState({
          kind: 'error',
          message: 'Push is not configured on the server yet.',
        })
        return
      }

      const reg = await navigator.serviceWorker.ready
      const applicationServerKey = urlBase64ToUint8Array(publicKey)
        .buffer as ArrayBuffer
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      })

      const raw = sub.toJSON() as {
        endpoint: string
        keys?: { p256dh?: string; auth?: string }
      }
      const p256dhRaw = sub.getKey('p256dh')
      const authRaw = sub.getKey('auth')

      const p256dh =
        raw.keys?.p256dh ?? (p256dhRaw ? toB64(p256dhRaw) : null)
      const auth = raw.keys?.auth ?? (authRaw ? toB64(authRaw) : null)

      if (!raw.endpoint || !p256dh || !auth) {
        throw new Error('Subscription is missing endpoint or keys.')
      }

      await saveSubscriptionAction({
        endpoint: raw.endpoint,
        keys: { p256dh, auth },
      })
      setState({ kind: 'done' })
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  async function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // ignore
    }

    // If the browser already has a subscription and the user is
    // dismissing before granting permission, also unsubscribe so
    // we do not leave a stale row in the DB.
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        await sub.unsubscribe()
        await removeSubscriptionAction(sub.endpoint)
      }
    } catch {
      // ignore
    }

    setState({ kind: 'dismissed' })
  }

  if (state.kind !== 'prompt' && state.kind !== 'error') return null

  return (
    <div className="fixed inset-x-0 bottom-3 z-30 mx-auto max-w-md px-3">
      <div className="rounded-md border border-stone-300 bg-white/95 shadow-lg backdrop-blur-sm px-4 py-3 text-sm text-stone-800">
        <p className="font-medium text-stone-900">
          Light up your home-screen icon when someone replies
        </p>
        <p className="mt-1 text-stone-600">
          Your phone will show a small dot on the icon so you know
          there&rsquo;s something new. We never send push notifications
          &mdash; no pings, no banners, just the icon changing.
        </p>
        {state.kind === 'error' ? (
          <p className="mt-2 text-xs text-red-700">{state.message}</p>
        ) : null}
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={enable}
            className="rounded bg-stone-900 text-stone-50 px-3 py-1.5 text-xs hover:bg-stone-700"
          >
            Enable badge
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="text-xs text-stone-600 hover:underline"
          >
            No thanks
          </button>
        </div>
      </div>
    </div>
  )
}
