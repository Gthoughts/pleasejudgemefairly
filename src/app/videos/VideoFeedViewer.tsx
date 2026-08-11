'use client'

import { useEffect, useRef, useState } from 'react'
import VideoPlayer from './VideoPlayer'
import type { FeedVideo } from '@/lib/videos/queries'

// TikTok-style vertical scroller. One video per snap-point, the one
// closest to the viewport centre is the "active" one and gets played,
// heartbeats, and reacts to gestures.
//
// Kept dumb on purpose. If we want infinite paging or preloading
// later we can layer it on; for now the initial payload is the whole
// list and the browser handles scroll snapping.

type PerVideoState = {
  canReport: boolean
  ownVote: 'helpful' | 'unhelpful' | null
  qualifiedAlready: boolean
}

export default function VideoFeedViewer({
  videos,
  isSignedIn,
  perVideoState,
}: {
  videos: FeedVideo[]
  isSignedIn: boolean
  perVideoState: Record<string, PerVideoState>
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [activeId, setActiveId] = useState<string | null>(
    videos[0]?.id ?? null
  )

  useEffect(() => {
    const root = containerRef.current
    if (!root) return

    const obs = new IntersectionObserver(
      (entries) => {
        // Pick the entry with the highest intersectionRatio > 0.5.
        let best: IntersectionObserverEntry | null = null
        for (const e of entries) {
          if (e.intersectionRatio < 0.5) continue
          if (!best || e.intersectionRatio > best.intersectionRatio) best = e
        }
        if (best) {
          const id = (best.target as HTMLElement).dataset.videoId
          if (id) setActiveId(id)
        }
      },
      { root, threshold: [0.25, 0.5, 0.75, 0.9] }
    )
    root
      .querySelectorAll<HTMLElement>('[data-video-id]')
      .forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [videos.length])

  // Fill the space between the top of this container and the bottom of
  // the viewport. The old CSS-var approach was never populated so the
  // scroller was a full 100vh, spilling below the fold. Measuring at
  // mount + on resize keeps snap points aligned with the visible slot
  // no matter how much header sits above.
  useEffect(() => {
    const root = containerRef.current
    if (!root) return
    const update = () => {
      const top = root.getBoundingClientRect().top
      root.style.height = `${window.innerHeight - top}px`
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [])

  if (videos.length === 0) {
    return (
      <div className="mx-auto max-w-md p-8 text-center text-stone-500">
        Nothing here yet. Be the first to add a video.
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="h-svh snap-y snap-mandatory overflow-y-scroll overscroll-contain bg-black"
    >
      {videos.map((v) => {
        const state = perVideoState[v.id] ?? {
          canReport: isSignedIn,
          ownVote: null,
          qualifiedAlready: false,
        }
        return (
          <div
            key={v.id}
            data-video-id={v.id}
            className="relative flex h-full w-full snap-start snap-always items-center justify-center"
          >
            <VideoPlayer
              video={v}
              active={activeId === v.id}
              canReport={state.canReport}
              ownVote={state.ownVote}
              qualifiedAlready={state.qualifiedAlready}
              isSignedIn={isSignedIn}
            />
          </div>
        )
      })}
    </div>
  )
}
