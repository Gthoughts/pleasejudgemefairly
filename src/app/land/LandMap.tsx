'use client'

import { useEffect, useRef, useState } from 'react'

// Interactive map for the Land page. Uses the Ordnance Survey Maps API
// (nicer UK detail) when a public OS key is configured via
// NEXT_PUBLIC_OS_MAPS_KEY; otherwise falls back to a free OpenStreetMap
// embed so the page works with no key at all. Leaflet is loaded from a
// CDN at runtime to avoid adding a build dependency.

const OS_KEY = process.env.NEXT_PUBLIC_OS_MAPS_KEY

// Centre roughly on the middle of Great Britain.
const DEFAULT_CENTER: [number, number] = [53.0, -1.5]
const DEFAULT_ZOOM = 6

export default function LandMap() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    let map: unknown = null

    async function loadLeafletAndInit() {
      try {
        // Inject Leaflet CSS once.
        if (!document.getElementById('leaflet-css')) {
          const link = document.createElement('link')
          link.id = 'leaflet-css'
          link.rel = 'stylesheet'
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
          document.head.appendChild(link)
        }
        // Load Leaflet JS if not present.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const w = window as any
        if (!w.L) {
          await new Promise<void>((resolve, reject) => {
            const s = document.createElement('script')
            s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
            s.onload = () => resolve()
            s.onerror = () => reject(new Error('Leaflet failed to load'))
            document.head.appendChild(s)
          })
        }
        if (cancelled || !containerRef.current) return
        const L = w.L

        map = L.map(containerRef.current).setView(DEFAULT_CENTER, DEFAULT_ZOOM)

        if (OS_KEY) {
          // Ordnance Survey Maps API (Web Mercator "Road" style).
          L.tileLayer(
            `https://api.os.uk/maps/raster/v1/zxy/Road_3857/{z}/{x}/{y}.png?key=${OS_KEY}`,
            {
              maxZoom: 20,
              attribution:
                'Contains OS data &copy; Crown copyright and database rights ' +
                new Date().getFullYear(),
            }
          ).addTo(map)
        } else {
          // Free OpenStreetMap fallback (no key required).
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors',
          }).addTo(map)
        }
      } catch {
        if (!cancelled) setFailed(true)
      }
    }

    loadLeafletAndInit()

    return () => {
      cancelled = true
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (map && (map as any).remove) (map as any).remove()
    }
  }, [])

  if (failed) {
    return (
      <div className="rounded border border-stone-200 bg-stone-50 p-4 text-sm text-stone-600">
        The map couldn&rsquo;t load. You can explore the data directly at{' '}
        <a
          href="https://overpass-turbo.eu/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-stone-900"
        >
          Overpass Turbo
        </a>
        .
      </div>
    )
  }

  return (
    <div>
      <div
        ref={containerRef}
        className="h-80 w-full rounded border border-stone-200"
        style={{ background: '#e7e5e4' }}
      />
      <p className="mt-1 text-xs text-stone-500">
        {OS_KEY
          ? 'Ordnance Survey mapping. Pan and zoom to explore an area.'
          : 'OpenStreetMap. Pan and zoom to explore an area.'}
      </p>
    </div>
  )
}
