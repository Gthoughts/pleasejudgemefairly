// Service worker for silent home-screen icon badges.
//
// Receives a Web Push payload of the shape { "badge": <integer> } and
// updates the installed PWA's icon badge via the Badging API. It never
// calls showNotification, so users see no banner, no sound, no ping —
// just the number on the icon changing.
//
// On iOS Safari 16.4+ the Badging API is available to installed PWAs
// once the user has granted notification permission. We ask for
// permission but never send a visible notification.

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// A no-op fetch handler is required by some Chrome versions before
// the PWA install prompt will appear. We just pass every request
// through to the network — no caching, no offline behaviour.
self.addEventListener('fetch', () => {
  // Intentionally empty.
})

self.addEventListener('push', (event) => {
  let count = 0
  try {
    const data = event.data ? event.data.json() : null
    if (data && typeof data.badge === 'number' && Number.isFinite(data.badge)) {
      count = Math.max(0, Math.floor(data.badge))
    }
  } catch (err) {
    // Malformed payload — leave count at 0 which clears the badge.
  }

  event.waitUntil(setBadge(count))
})

async function setBadge(count) {
  try {
    if (count > 0 && self.navigator && self.navigator.setAppBadge) {
      await self.navigator.setAppBadge(count)
    } else if (self.navigator && self.navigator.clearAppBadge) {
      await self.navigator.clearAppBadge()
    }
  } catch (err) {
    // Silently ignore — browser may not support the Badging API.
  }
}

// When the user taps the icon and opens the PWA, focus an existing
// window if there is one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ('focus' in client) return client.focus()
        }
        if (self.clients.openWindow) return self.clients.openWindow('/')
        return undefined
      })
  )
})
