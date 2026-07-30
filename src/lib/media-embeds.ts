// Detect video URLs in user-posted content so we can render an inline
// click-to-play embed instead of leaving the link as a plain URL.
// Kept intentionally narrow: only the platforms whose embed players
// are lightweight, privacy-respecting, and don't require an oEmbed
// round trip. Anything else stays as a normal auto-linked URL.

export type EmbedInfo =
  | { platform: 'youtube'; id: string; url: string }
  | { platform: 'vimeo'; id: string; url: string }
  | { platform: 'tiktok'; id: string; url: string }
  | { platform: 'instagram'; id: string; url: string }

// One line of a post, either as a plain URL (auto-link it) or an
// embeddable video.
export type LinkOrEmbed =
  | { kind: 'text'; value: string }
  | { kind: 'link'; url: string }
  | { kind: 'embed'; info: EmbedInfo }

const YT_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com'])
const YT_SHORT = new Set(['youtu.be', 'www.youtu.be'])
const VIMEO_HOSTS = new Set(['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'])
const TIKTOK_HOSTS = new Set(['tiktok.com', 'www.tiktok.com', 'm.tiktok.com'])
const IG_HOSTS = new Set(['instagram.com', 'www.instagram.com', 'm.instagram.com'])

export function detectEmbed(rawUrl: string): EmbedInfo | null {
  let u: URL
  try {
    u = new URL(rawUrl)
  } catch {
    return null
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null

  const host = u.hostname.toLowerCase()

  if (YT_HOSTS.has(host)) {
    if (u.pathname === '/watch') {
      const id = u.searchParams.get('v')
      if (id && /^[\w-]{6,}$/.test(id))
        return { platform: 'youtube', id, url: rawUrl }
    }
    const shorts = u.pathname.match(/^\/shorts\/([\w-]{6,})/)
    if (shorts) return { platform: 'youtube', id: shorts[1], url: rawUrl }
    const embed = u.pathname.match(/^\/embed\/([\w-]{6,})/)
    if (embed) return { platform: 'youtube', id: embed[1], url: rawUrl }
    return null
  }

  if (YT_SHORT.has(host)) {
    const id = u.pathname.replace(/^\//, '').split(/[/?#]/)[0]
    if (id && /^[\w-]{6,}$/.test(id))
      return { platform: 'youtube', id, url: rawUrl }
    return null
  }

  if (VIMEO_HOSTS.has(host)) {
    const m = u.pathname.match(/^\/(?:video\/)?(\d+)/)
    if (m) return { platform: 'vimeo', id: m[1], url: rawUrl }
    return null
  }

  if (TIKTOK_HOSTS.has(host)) {
    // /@user/video/ID
    const m = u.pathname.match(/\/video\/(\d+)/)
    if (m) return { platform: 'tiktok', id: m[1], url: rawUrl }
    return null
  }

  if (IG_HOSTS.has(host)) {
    // /reel/<id> or /reels/<id>
    const m = u.pathname.match(/^\/(?:reel|reels)\/([\w-]+)/)
    if (m) return { platform: 'instagram', id: m[1], url: rawUrl }
    return null
  }

  return null
}

const URL_REGEX = /(https?:\/\/[^\s<>"']+)/gi

// Splits raw post text into a sequence of text runs, plain-URL runs,
// and embed runs. A URL that stands entirely on its own line becomes
// an embed if it matches a known video platform; otherwise it's just
// a clickable link.
export function parsePostContent(content: string): LinkOrEmbed[] {
  const out: LinkOrEmbed[] = []
  const lines = content.split(/\r?\n/)

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx]
    const trimmed = line.trim()

    // Whole-line URL: candidate for an embed.
    if (/^https?:\/\/\S+$/i.test(trimmed)) {
      const embed = detectEmbed(trimmed)
      if (embed) {
        out.push({ kind: 'embed', info: embed })
        if (idx < lines.length - 1) out.push({ kind: 'text', value: '\n' })
        continue
      }
      out.push({ kind: 'link', url: trimmed })
      if (idx < lines.length - 1) out.push({ kind: 'text', value: '\n' })
      continue
    }

    // Otherwise: mixed text; auto-link any URLs inside.
    let last = 0
    URL_REGEX.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = URL_REGEX.exec(line))) {
      if (match.index > last) {
        out.push({ kind: 'text', value: line.slice(last, match.index) })
      }
      out.push({ kind: 'link', url: match[0] })
      last = match.index + match[0].length
    }
    if (last < line.length) {
      out.push({ kind: 'text', value: line.slice(last) })
    }
    if (idx < lines.length - 1) out.push({ kind: 'text', value: '\n' })
  }

  return out
}

export function embedIframeUrl(info: EmbedInfo): string {
  switch (info.platform) {
    case 'youtube':
      // mute=1 is required for browsers to honour autoplay=1 in an
      // iframe; without it the video is loaded but never starts.
      // playsinline=1 keeps iOS from flipping fullscreen on tap.
      // enablejsapi=1 lets us postMessage commands (unmute etc.)
      // from the parent without loading YouTube's tracking-heavy
      // JS SDK.
      return `https://www.youtube-nocookie.com/embed/${info.id}?rel=0&modestbranding=1&autoplay=1&mute=1&playsinline=1&enablejsapi=1`
    case 'vimeo':
      return `https://player.vimeo.com/video/${info.id}?dnt=1&autoplay=1&muted=1&playsinline=1`
    case 'tiktok':
      return `https://www.tiktok.com/embed/v2/${info.id}?autoplay=1&muted=1`
    case 'instagram':
      return `https://www.instagram.com/reel/${info.id}/embed/`
  }
}

export function embedThumbnailUrl(info: EmbedInfo): string | null {
  if (info.platform === 'youtube') {
    return `https://i.ytimg.com/vi/${info.id}/hqdefault.jpg`
  }
  return null
}

export function embedPlatformLabel(info: EmbedInfo): string {
  switch (info.platform) {
    case 'youtube':
      return 'YouTube'
    case 'vimeo':
      return 'Vimeo'
    case 'tiktok':
      return 'TikTok'
    case 'instagram':
      return 'Instagram'
  }
}
