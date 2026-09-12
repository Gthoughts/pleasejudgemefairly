'use client'

// Small client component rendering an OpenStreetMap embed for a meetup's
// geocoded location. Lives in its own client file for cleanliness even
// though a handler-free iframe is fine in a server component too.

export default function LocationMap({
  latitude,
  longitude,
  location,
}: {
  latitude: number
  longitude: number
  location: string
}) {
  const bbox = `${longitude - 0.01}%2C${latitude - 0.01}%2C${
    longitude + 0.01
  }%2C${latitude + 0.01}`
  const embedSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude}%2C${longitude}`
  const largerHref = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=15/${latitude}/${longitude}`

  return (
    <div>
      <iframe
        src={embedSrc}
        title={`Map of ${location}`}
        loading="lazy"
        className="w-full rounded border border-stone-200"
        style={{ height: 240 }}
      />
      <a
        href={largerHref}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 inline-block text-xs text-stone-500 underline hover:text-stone-800"
      >
        View larger map
      </a>
    </div>
  )
}
