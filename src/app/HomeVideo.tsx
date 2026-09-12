'use client'

import { useState } from 'react'

// Small home-page video with a cover image ("dancing man") sitting over the
// top. Clicking the X removes the cover to reveal the YouTube player; the
// visitor then presses play themselves (no autoplay).

export default function HomeVideo({ videoId }: { videoId: string }) {
  const [covered, setCovered] = useState(true)

  return (
    <div className="relative w-full aspect-video rounded-lg overflow-hidden shadow-md ring-1 ring-stone-300 bg-black">
      <iframe
        className="absolute inset-0 h-full w-full"
        src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`}
        title="Homepage video"
        loading="lazy"
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />

      {covered && (
        <div className="absolute inset-0">
          {/* Cover image sitting over the video */}
          <img
            src="/home/dancing-man.png"
            alt="Watch the video"
            className="h-full w-full object-cover"
          />
          {/* X to remove the cover */}
          <button
            type="button"
            onClick={() => setCovered(false)}
            aria-label="Remove cover and show the video"
            className="absolute top-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-stone-50 text-sm leading-none hover:bg-black/80 focus:outline-none focus:ring-2 focus:ring-white/70"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
