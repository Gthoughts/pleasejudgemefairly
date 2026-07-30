// Constants and helpers for the "50% watched before you can vote"
// gate. Kept separate from the DB shape so the same numbers can be
// used on the client (video player) and server (RLS on ratings).

// A user must have watched at least this fraction of the video
// (measured by unique seconds observed, not scrub-past) before their
// swipe registers as a vote. Enforced client-side (UX) and server-
// side (RLS policy on ratings). Keep in sync with the RLS check in
// phase19_videos.sql.
export const WATCH_GATE_PERCENT = 50

// A video below this many qualified views does not appear in the
// ranked topic feed at all — it lives only in Random until it warms
// up. Keep in sync with feed queries.
export const RANKING_MIN_QUALIFIED_VIEWS = 10

// Client-side heartbeat cadence for reporting watched_seconds back
// to the server. Balance between responsiveness and request volume.
export const WATCH_HEARTBEAT_MS = 5_000

export function isPastWatchGate(watchedPercent: number): boolean {
  return watchedPercent >= WATCH_GATE_PERCENT
}
