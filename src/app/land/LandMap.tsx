'use client'

import { useEffect, useRef, useState } from 'react'

// Interactive map for the Land page. Uses the Ordnance Survey Maps API
// (nicer UK detail) when a public OS key is configured via
// NEXT_PUBLIC_OS_MAPS_KEY; otherwise falls back to a free OpenStreetMap
// tile layer so the page works with no key at all. Leaflet is loaded from
// a CDN at runtime to avoid adding a build dependency.

const OS_KEY = process.env.NEXT_PUBLIC_OS_MAPS_KEY

// Centre roughly on the middle of Great Britain.
const DEFAULT_CENTER: [number, number] = [53.0, -1.5]
const DEFAULT_ZOOM = 6

function loadCss(): Promise<void> {
  return new Promise((resolve) => {
    const existing = document.getElementById('leaflet-css') as HTMLLinkElement | null
    if (existing) {
      resolve()
      return
    }
    const link = document.createElement('link')
    link.id = 'leaflet-css'
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    // Resolve on load OR error so we never hang; also resolve after a short
    // timeout as a belt-and-braces fallback.
    link.onload = () => resolve()
    link.onerror = () => resolve()
    document.head.appendChild(link)
    setTimeout(resolve, 1500)
  })
}

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).L) {
      resolve()
      return
    }
    const s = document.createElement('script')
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Leaflet failed to load'))
    document.head.appendChild(s)
  })
}

export default function LandMap() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let map: any = null

    async function init() {
      try {
        // CSS FIRST (Leaflet mis-renders tiles without its stylesheet),
        // then the library.
        await loadCss()
        await loadScript()
        if (cancelled || !containerRef.current) return

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const L = (window as any).L
        if (!L) {
          setFailed(true)
          return
        }

        map = L.map(containerRef.current, {
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
        })

        if (OS_KEY) {
          L.tileLayer(
            `https://api.os.uk/maps/raster/v1/zxy/Light_3857/{z}/{x}/{y}.png?key=${OS_KEY}`,
            {
              maxZoom: 20,
              attribution:
                'Contains OS data &copy; Crown copyright and database rights ' +
                new Date().getFullYear(),
            }
          ).addTo(map)
        } else {
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors',
          }).addTo(map)
        }

        // The container may have had zero size at creation (fonts/layout
        // still settling); recompute so tiles actually load.
        setTimeout(() => {
          if (!cancelled && map) map.invalidateSize()
        }, 200)
      } catch {
        if (!cancelled) setFailed(true)
      }
    }

    init()

    return () => {
      cancelled = true
      if (map && map.remove) map.remove()
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
