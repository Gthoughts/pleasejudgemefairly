'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type TouchEvent as ReactTouchEvent,
} from 'react'
import { useRouter } from 'next/navigation'
import {
  WATCH_GATE_PERCENT,
  WATCH_HEARTBEAT_MS,
} from '@/lib/videos/watch'
import { REPORT_LONG_PRESS_MS } from '@/lib/videos/reports'
import { detectEmbed, embedIframeUrl } from '@/lib/media-embeds'
import type { FeedVideo } from '@/lib/videos/queries'
import ReportModal from './ReportModal'
import {
  reportWatchProgressAction,
  voteOnVideoAction,
} from './actions'

// The core video player. One instance per video in the feed. Handles
// four gestures via a transparent overlay above the video surface so
// they fire even when the surface is a cross-origin iframe (YouTube
// / TikTok / Vimeo), which would otherwise swallow pointer events:
//
//   swipe left            -> vote helpful
//   swipe right           -> vote unhelpful
//   swipe up              -> open comments (/videos/[id])
//   long-press (3s)       -> open the Report modal
//   tap (< 200ms, < 8px)  -> play/pause the underlying <video>
//                            (no-op for iframe surfaces)
//
// Watch tracking has two modes:
//   * native <video>: read currentTime on timeupdate.
//   * iframe embed:   accumulate wall-clock while this player is
//                     active and the tab is visible. Precise-enough
//                     for the 50% vote gate given the iframe cannot
//                     hand us its own currentTime without loading
//                     each platform's JS SDK (which brings ads and
//                     trackers we deliberately do not want).
//
// The vote gate itself is enforced by RLS on the ratings insert;
// here we use the client state only to soften the UX.

type Props = {
  video: FeedVideo
  active: boolean            // is this video currently the "in view" one
  canReport: boolean         // has the current user still got report privilege
  ownVote: 'helpful' | 'unhelpful' | null
  qualifiedAlready: boolean  // did the user already cross the gate before
  isSignedIn: boolean
}

type SwipeDir = 'left' | 'right' | 'up' | null

const SWIPE_THRESHOLD_PX = 60
const SWIPE_MAX_DURATION_MS = 500
const TAP_MAX_DURATION_MS = 200
const TAP_MAX_TRAVEL_PX = 8
// Fallback duration we use to compute the 50% gate if the uploader
// didn't tell us the video length (iframe path can't tell us either).
const FALLBACK_DURATION_S = 60

export default function VideoPlayer({
  video,
  active,
  canReport,
  ownVote,
  qualifiedAlready,
  isSignedIn,
}: Props) {
  const router = useRouter()
  const videoElRef = useRef<HTMLVideoElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Watch tracker: current best "seconds ever watched" for this
  // (user, video). Feeds the heartbeat and the qualification check.
  const watchedSecondsRef = useRef<number>(0)
  const lastReportedRef = useRef<number>(0)

  // Wall-clock timer state for iframe videos. accumulated = seconds
  // clocked in previous active windows; startedAt = timestamp of the
  // current active window (or 0 when paused).
  const wallClockRef = useRef<{ accumulated: number; startedAt: number }>({
    accumulated: 0,
    startedAt: 0,
  })

  const [qualified, setQualified] = useState<boolean>(qualifiedAlready)
  const [voteFlash, setVoteFlash] = useState<'helpful' | 'unhelpful' | null>(
    ownVote
  )
  const [gestureHint, setGestureHint] = useState<string | null>(null)
  const [reportOpen, setReportOpen] = useState<boolean>(false)
  const [playing, setPlaying] = useState<boolean>(false)

  // Debug: shows which event source fired, if any. Only rendered
  // in the top-right of the player. Values: 'pointer' | 'touch' | null.
  const [debugFired, setDebugFired] = useState<string | null>(null)
  const debugTick = (label: string) => {
    setDebugFired(label)
    setTimeout(() => setDebugFired((v) => (v === label ? null : v)), 800)
  }

  // Long-press progress (0..1)
  const [pressProgress, setPressProgress] = useState<number>(0)
  const pressStartRef = useRef<number | null>(null)
  const pressRafRef = useRef<number | null>(null)

  // Pointer / touch tracking for tap vs swipe classification.
  // We wire BOTH pointer and touch handlers because on some mobile
  // browsers pointer events on an absolute overlay inside a
  // scroll-snap container never fire. Whichever event system wins,
  // we absorb the other via `justHandledAtRef` so the gesture only
  // fires once.
  const pointerStartRef = useRef<{
    x: number
    y: number
    t: number
  } | null>(null)
  const justHandledAtRef = useRef<number>(0)

  const embed = useMemo(() => {
    if (video.source_type !== 'external' || !video.external_url) return null
    return detectEmbed(video.external_url)
  }, [video.source_type, video.external_url])

  const isNativeVideo =
    video.source_type === 'upload' && !!video.storage_ref
  const isIframe = !isNativeVideo && !!embed

  const effectiveDuration = video.duration_seconds ?? FALLBACK_DURATION_S

  // Read the current best-known watched seconds, taking the
  // wall-clock window into account for iframe videos.
  const readCurrentWatched = useCallback((): number => {
    let best = watchedSecondsRef.current
    if (isIframe && wallClockRef.current.startedAt > 0) {
      const elapsed =
        (Date.now() - wallClockRef.current.startedAt) / 1000
      best = Math.max(
        best,
        wallClockRef.current.accumulated + elapsed
      )
    }
    return best
  }, [isIframe])

  // ----- Watch heartbeat to the server -----
  const heartbeat = useCallback(async () => {
    if (!isSignedIn) return
    const watched = Math.floor(readCurrentWatched())
    if (watched <= lastReportedRef.current) return
    lastReportedRef.current = watched
    try {
      const fd = new FormData()
      fd.set('video_id', video.id)
      fd.set('watched_seconds', String(watched))
      await reportWatchProgressAction(fd)
    } catch {
      // Best-effort; a dropped heartbeat is fine, next one will win.
    }
  }, [isSignedIn, readCurrentWatched, video.id])

  // ----- Native <video> timeupdate + play/pause bookkeeping -----
  useEffect(() => {
    if (!active || !isNativeVideo) return
    const el = videoElRef.current
    if (!el) return

    const onTime = () => {
      const t = el.currentTime
      if (t > watchedSecondsRef.current) watchedSecondsRef.current = t
    }
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('play', onPlay)
    el.addEventListener('pause', onPause)
    return () => {
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('play', onPlay)
      el.removeEventListener('pause', onPause)
    }
  }, [active, isNativeVideo])

  // ----- Wall-clock tracker for iframe videos -----
  useEffect(() => {
    if (!active || !isIframe) return

    // Enter active window when visible; leave when hidden.
    const enter = () => {
      if (wallClockRef.current.startedAt === 0)
        wallClockRef.current.startedAt = Date.now()
    }
    const leave = () => {
      if (wallClockRef.current.startedAt > 0) {
        wallClockRef.current.accumulated +=
          (Date.now() - wallClockRef.current.startedAt) / 1000
        wallClockRef.current.startedAt = 0
      }
    }
    const onVis = () => {
      if (document.hidden) leave()
      else enter()
    }
    document.addEventListener('visibilitychange', onVis)
    if (!document.hidden) enter()

    return () => {
      document.removeEventListener('visibilitychange', onVis)
      leave()
    }
  }, [active, isIframe])

  // ----- Qualification check + heartbeat interval -----
  useEffect(() => {
    if (!active) return
    const iv = setInterval(() => {
      const watched = readCurrentWatched()
      if (!qualified && effectiveDuration > 0) {
        const pct = (watched / effectiveDuration) * 100
        if (pct >= WATCH_GATE_PERCENT) setQualified(true)
      }
      heartbeat()
    }, WATCH_HEARTBEAT_MS)
    return () => {
      clearInterval(iv)
      // One last shot on unmount.
      heartbeat()
    }
  }, [active, heartbeat, qualified, effectiveDuration, readCurrentWatched])

  // Play/pause the native video when this becomes the active card.
  useEffect(() => {
    if (!isNativeVideo) return
    const el = videoElRef.current
    if (!el) return
    if (active) el.play().catch(() => {})
    else el.pause()
  }, [active, isNativeVideo])

  // ----- Gesture handling on the transparent overlay -----

  // Shared start/end/cancel logic used by both pointer and touch
  // handler pairs. `x`, `y` are viewport coordinates. Wrapped in
  // useCallback so the react-hooks/purity lint sees them as
  // handler-only, not render-time, calls.

  const beginGesture = useCallback((x: number, y: number) => {
    pointerStartRef.current = { x, y, t: Date.now() }
    pressStartRef.current = Date.now()
    setPressProgress(0)
    const tick = () => {
      if (pressStartRef.current === null) return
      const elapsed = Date.now() - pressStartRef.current
      const p = Math.min(1, elapsed / REPORT_LONG_PRESS_MS)
      setPressProgress(p)
      if (p >= 1) {
        pressStartRef.current = null
        pointerStartRef.current = null
        setPressProgress(0)
        if (canReport && isSignedIn) {
          setReportOpen(true)
        } else if (!isSignedIn) {
          setGestureHint('Sign in to report a video.')
          setTimeout(() => setGestureHint(null), 1400)
        } else {
          setGestureHint('Your ability to report videos has been revoked.')
          setTimeout(() => setGestureHint(null), 1800)
        }
        return
      }
      pressRafRef.current = requestAnimationFrame(tick)
    }
    pressRafRef.current = requestAnimationFrame(tick)
  }, [canReport, isSignedIn])

  const endGesture = useCallback((x: number, y: number) => {
    cancelPress()
    const start = pointerStartRef.current
    pointerStartRef.current = null
    if (!start) return
    const dx = x - start.x
    const dy = y - start.y
    const dt = Date.now() - start.t
    const adx = Math.abs(dx)
    const ady = Math.abs(dy)

    if (
      dt <= TAP_MAX_DURATION_MS &&
      adx <= TAP_MAX_TRAVEL_PX &&
      ady <= TAP_MAX_TRAVEL_PX
    ) {
      if (isNativeVideo) togglePlay()
      return
    }

    if (dt > SWIPE_MAX_DURATION_MS) return
    let dir: SwipeDir = null
    if (adx > ady && adx >= SWIPE_THRESHOLD_PX) {
      dir = dx > 0 ? 'right' : 'left'
    } else if (ady > adx && ady >= SWIPE_THRESHOLD_PX && dy < 0) {
      dir = 'up'
    }
    if (dir === 'left') doVote('helpful')
    else if (dir === 'right') doVote('unhelpful')
    else if (dir === 'up') openComments()
  // doVote / openComments / togglePlay / isNativeVideo are stable
  // for our purposes; deliberately omitted from deps to avoid
  // recreating the handler on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cancelPress = () => {
    pressStartRef.current = null
    setPressProgress(0)
    if (pressRafRef.current !== null) {
      cancelAnimationFrame(pressRafRef.current)
      pressRafRef.current = null
    }
  }

  const DEDUPE_MS = 400 // how long to absorb the sibling event system

  const onPointerDown = (e: ReactPointerEvent) => {
    debugTick(`P down (${e.pointerType})`)
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (Date.now() - justHandledAtRef.current < DEDUPE_MS) return
    try {
      ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    } catch {
      // safe to ignore
    }
    beginGesture(e.clientX, e.clientY)
  }

  const doVote = async (rating: 'helpful' | 'unhelpful') => {
    if (!isSignedIn) {
      setGestureHint('Sign in to vote.')
      setTimeout(() => setGestureHint(null), 1200)
      return
    }
    if (!qualified) {
      setGestureHint(`Watch at least ${WATCH_GATE_PERCENT}% before voting.`)
      setTimeout(() => setGestureHint(null), 1600)
      return
    }
    setVoteFlash(rating)
    try {
      const fd = new FormData()
      fd.set('video_id', video.id)
      fd.set('rating', rating)
      await voteOnVideoAction(fd)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Vote failed.'
      setGestureHint(msg)
      setTimeout(() => setGestureHint(null), 1800)
      setVoteFlash(ownVote)
    }
  }

  const openComments = () => {
    router.push(`/videos/${video.id}`)
  }

  const togglePlay = () => {
    const el = videoElRef.current
    if (!el) return
    if (el.paused) el.play().catch(() => {})
    else el.pause()
  }

  const onPointerUp = (e: ReactPointerEvent) => {
    if (pointerStartRef.current === null) return
    justHandledAtRef.current = Date.now()
    endGesture(e.clientX, e.clientY)
  }

  const onPointerCancel = () => {
    cancelPress()
    pointerStartRef.current = null
  }

  const onTouchStart = (e: ReactTouchEvent) => {
    debugTick('T start')
    if (Date.now() - justHandledAtRef.current < DEDUPE_MS) return
    const t = e.touches[0]
    if (!t) return
    beginGesture(t.clientX, t.clientY)
  }

  const onTouchEnd = (e: ReactTouchEvent) => {
    if (pointerStartRef.current === null) return
    justHandledAtRef.current = Date.now()
    const t = e.changedTouches[0]
    if (!t) return
    endGesture(t.clientX, t.clientY)
  }

  const onTouchCancel = () => {
    cancelPress()
    pointerStartRef.current = null
  }

  // ----- Rendering -----

  return (
    <div
      ref={containerRef}
      className="relative flex h-full w-full items-center justify-center bg-black select-none"
    >
      {/* Video surface: sits underneath. Note: no `controls` on the
          native video, and no pointer-events on the iframe (we drive
          gestures from the overlay above). */}
      {isNativeVideo ? (
        <video
          ref={videoElRef}
          src={video.storage_ref ?? undefined}
          playsInline
          loop
          muted={false}
          className="max-h-full max-w-full object-contain"
        />
      ) : embed ? (
        <iframe
          src={embedIframeUrl(embed)}
          className="pointer-events-none h-full w-full"
          title={video.title}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : video.external_url ? (
        <a
          href={video.external_url}
          target="_blank"
          rel="noreferrer"
          className="p-6 text-center text-stone-100 underline"
        >
          Open on external site
        </a>
      ) : (
        <div className="p-6 text-center text-stone-100">Video unavailable</div>
      )}

      {/* Transparent gesture overlay. Sits above the iframe/video and
          catches every pointer / touch event so gestures work no
          matter what the underlying surface is. We deliberately do
          NOT cover the bottom-left ~70x70 corner of the video, so
          that YouTube / TikTok / Vimeo's own unmute button (which
          sits there on their embed players) remains tappable. */}
      <div
        className="absolute inset-0 z-10 touch-none"
        style={{
          background: 'transparent',
          clipPath:
            'polygon(0 0, 100% 0, 100% 100%, 70px 100%, 70px calc(100% - 70px), 0 calc(100% - 70px))',
        }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchCancel}
      />

      {/* Title strip (above overlay, not interactive) */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/70 to-transparent p-4 text-stone-100">
        <div className="text-sm font-medium leading-snug">{video.title}</div>
        {video.description ? (
          <div className="mt-1 line-clamp-2 text-xs text-stone-300">
            {video.description}
          </div>
        ) : null}
      </div>

      {/* Bottom hint strip */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/70 to-transparent p-4 text-center text-[11px] text-stone-300">
        {isSignedIn ? (
          <>
            <span>swipe left: helpful</span>
            <span className="mx-2">|</span>
            <span>right: unhelpful</span>
            <span className="mx-2">|</span>
            <span>up: comments</span>
            <span className="mx-2">|</span>
            <span>hold 3s: report</span>
            {!qualified ? (
              <div className="mt-1">
                watch {WATCH_GATE_PERCENT}% before your vote counts
                {isIframe && !video.duration_seconds ? (
                  <> (uploader did not set duration, using {FALLBACK_DURATION_S}s)</>
                ) : null}
              </div>
            ) : null}
          </>
        ) : (
          <span>swipe up for comments. Sign in to vote or report.</span>
        )}
      </div>

      {/* Vote flash */}
      {voteFlash ? (
        <div
          className={
            'pointer-events-none absolute top-1/2 left-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-full px-4 py-2 text-sm font-medium ' +
            (voteFlash === 'helpful'
              ? 'bg-emerald-500/85 text-white'
              : 'bg-stone-500/85 text-white')
          }
        >
          {voteFlash === 'helpful' ? 'helpful' : 'unhelpful'}
        </div>
      ) : null}

      {/* Long-press progress ring */}
      {pressProgress > 0.05 ? (
        <div
          className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
          aria-hidden="true"
        >
          <div
            className="h-24 w-24 rounded-full border-4 border-white/30"
            style={{
              background: `conic-gradient(rgba(220,38,38,0.85) ${
                pressProgress * 360
              }deg, transparent ${pressProgress * 360}deg)`,
            }}
          />
        </div>
      ) : null}

      {/* Native-video play state overlay: shows a small hint when
          paused so users know a tap will resume. Only for <video>. */}
      {isNativeVideo && !playing ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <span className="rounded-full bg-white/85 px-3 py-1 text-xs font-medium text-stone-900">
            tap to play
          </span>
        </div>
      ) : null}

      {/* Gesture hint */}
      {gestureHint ? (
        <div className="pointer-events-none absolute bottom-24 left-1/2 z-20 -translate-x-1/2 rounded bg-stone-900/85 px-3 py-1.5 text-xs text-stone-100 shadow">
          {gestureHint}
        </div>
      ) : null}

      {/* Debug indicator: top-right corner. Flashes on every pointer
          or touch event that reaches the overlay. If this NEVER
          flashes when you touch the video, the overlay is not
          receiving events. If it flashes but no swipe / long-press
          fires, the downstream classification is the problem. */}
      <div className="pointer-events-none absolute top-2 right-2 z-30 rounded bg-black/70 px-2 py-1 text-[10px] font-mono text-white">
        {debugFired ?? 'touch me'}
      </div>

      {reportOpen ? (
        <ReportModal
          videoId={video.id}
          onClose={() => setReportOpen(false)}
        />
      ) : null}
    </div>
  )
}
