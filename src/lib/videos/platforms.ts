// Recognised short-form portrait video platforms. This site is
// intentionally scoped to short-form content, so we only accept
// URLs from three sources:
//
//   * YouTube Shorts     (/shorts/<id>)
//   * TikTok             (/@user/video/<id>)
//   * Instagram Reels    (/reel/<id> or /reels/<id>)
//
// A URL that isn't one of the above is rejected at upload time
// with a message telling the uploader why.
//
// Keep this list in sync with the check constraint on
// videos.external_platform in the DB.

export const VIDEO_PLATFORMS = ['youtube', 'tiktok', 'instagram'] as const

export type VideoPlatform = (typeof VIDEO_PLATFORMS)[number]

const PLATFORM_LABELS: Record<VideoPlatform, string> = {
  youtube: 'YouTube Shorts',
  tiktok: 'TikTok',
  instagram: 'Instagram Reels',
}

export function platformLabel(p: VideoPlatform): string {
  return PLATFORM_LABELS[p]
}

// Detect a supported short-form platform from a pasted URL, or
// return null if the URL is anything else (including a normal
// landscape YouTube video, a Vimeo video, a Twitter post, etc).
//
// The check is intentionally strict: it looks at the URL PATH, not
// just the host, so `youtube.com/watch?v=...` (regular long-form)
// is rejected even though the host is YouTube.
export function detectPlatform(rawUrl: string): VideoPlatform | null {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return null
  }
  const host = url.hostname.toLowerCase()
  const path = url.pathname

  // YouTube Shorts only (long-form landscape videos are rejected).
  if (
    (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) &&
    /^\/shorts\/[\w-]{6,}/.test(path)
  ) {
    return 'youtube'
  }

  // TikTok video URL is /@user/video/<id> or /video/<id> in the
  // legacy form. TikTok's content is portrait short-form by default.
  if (host.endsWith('tiktok.com') && /\/video\/\d+/.test(path)) {
    return 'tiktok'
  }

  // Instagram Reels only (posts, stories, and IGTV are not
  // supported and would fail to render vertically anyway).
  if (
    host.endsWith('instagram.com') &&
    /^\/(reel|reels)\/[\w-]+/.test(path)
  ) {
    return 'instagram'
  }

  return null
}

// A friendly message the upload form shows when detectPlatform
// returns null.
export const REJECTED_URL_MESSAGE =
  'This site only accepts short-form portrait video links: ' +
  'YouTube Shorts (youtube.com/shorts/…), TikTok (tiktok.com/@user/video/…), ' +
  'or Instagram Reels (instagram.com/reel/…).'
