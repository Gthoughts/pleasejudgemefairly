'use client'

import { useState } from 'react'
import {
  embedIframeUrl,
  embedThumbnailUrl,
  embedPlatformLabel,
  type EmbedInfo,
} from '@/lib/media-embeds'

// Renders a click-to-play placeholder for a supported video URL
// (YouTube, Vimeo, TikTok). Only mounts the iframe when the user
// clicks, so the platform's player and its tracking never load on
// page render — the user is opting in explicitly.

export default function InlineVideoEmbed({ info }: { info: EmbedInfo }) {
  const [playing, setPlaying] = useState(false)

  if (playing) {
    const isTikTok = info.platform === 'tiktok'
    return (
      <div
        className={
          'my-3 overflow-hidden rounded border border-stone-200 bg-black ' +
          (isTikTok ? 'aspect-[9/16] max-w-xs mx-auto' : 'aspect-video')
        }
      >
        <iframe
          src={embedIframeUrl(info)}
          className="h-full w-full"
          title={`${embedPlatformLabel(info)} video`}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    )
  }

  const thumb = embedThumbnailUrl(info)
  const isTikTok = info.platform === 'tiktok'

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={`Play ${embedPlatformLabel(info)} video`}
      className={
        'my-3 group relative flex w-full items-center justify-center overflow-hidden rounded border border-stone-200 bg-stone-900 ' +
        (isTikTok ? 'aspect-[9/16] max-w-xs mx-auto' : 'aspect-video')
      }
    >
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumb}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-70 transition-opacity group-hover:opacity-90"
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-stone-800 to-stone-950" />
      )}

      <div className="relative flex flex-col items-center gap-2 text-stone-50">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 text-stone-900 shadow-lg transition-transform group-hover:scale-105">
          <PlayIcon />
        </span>
        <span className="rounded bg-black/60 px-2 py-0.5 text-xs">
          Play on {embedPlatformLabel(info)}
        </span>
      </div>
    </button>
  )
}

function PlayIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}
