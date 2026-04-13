// Automatic content filter.
//
// Called from the post-creation server actions. Walks the content
// against every pattern in filters/config.ts and returns a list of
// trigger reasons (may be empty). The caller decides what to do with
// the result - currently: if any reason fires, the post is held for
// review with a visible banner.
//
// Design notes:
//   - Every rule is additive and optional. Adding a new rule here
//     should never affect the others.
//   - No rule returns severity or confidence. A match is a match; the
//     community's cross-perspective rating is the safety net for
//     false positives, not a per-rule score.
//   - The filter has no memory of its own. Duplicate detection and
//     new-account link limits need data passed in by the caller.

import { FILTER_CONFIG, FILTER_REASONS, type FilterReason } from './config'

export type FilterContext = {
  // Author account age in days. null = unknown (we then skip the
  // new-account check rather than guess).
  authorAccountAgeDays: number | null
  // Normalised recent posts by the same author within the duplicate
  // window. Pass the NORMALISED content (see normaliseContent below)
  // so the filter can compare directly. Empty array means "no recent
  // posts, skip the duplicate check".
  recentNormalisedPosts: string[]
}

export type FilterResult = {
  held: boolean
  reasons: FilterReason[]
}

// Case-insensitive, whitespace-normalised, otherwise-exact. Used both
// by the filter and by the action that fetches recent posts so both
// sides normalise identically.
export function normaliseContent(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

// Extract all URL-ish strings from content. Returns the parsed URL
// objects for callers that want to inspect host or query params, and
// the raw matches for callers that just want to count.
export function extractUrls(content: string): URL[] {
  const matches = content.match(/\bhttps?:\/\/[^\s<>"']+/gi) ?? []
  const urls: URL[] = []
  for (const m of matches) {
    try {
      urls.push(new URL(m))
    } catch {
      // Malformed, skip. We intentionally do not flag malformed URLs
      // as a filter signal - that's not a "making money" signal.
    }
  }
  return urls
}

function hostMatchesList(host: string, list: string[]): boolean {
  const h = host.toLowerCase()
  for (const entry of list) {
    const e = entry.toLowerCase()
    // Treat a list entry with a "/" as a host+path prefix match
    // (e.g. "paypal.com/donate"). Host-only entries match the
    // hostname exactly or as a subdomain.
    if (e.includes('/')) {
      // Not applied here - we compared host only. Path match happens
      // in the caller with the full URL.
      const [hostPart] = e.split('/', 1)
      if (h === hostPart || h.endsWith('.' + hostPart)) return true
    } else {
      if (h === e || h.endsWith('.' + e)) return true
    }
  }
  return false
}

function urlMatchesPaymentList(url: URL): boolean {
  const h = url.hostname.toLowerCase()
  const path = url.pathname.toLowerCase()
  for (const entry of FILTER_CONFIG.paymentDomains) {
    const e = entry.toLowerCase()
    if (e.includes('/')) {
      const [hostPart, ...pathParts] = e.split('/')
      const pathPrefix = '/' + pathParts.join('/')
      if ((h === hostPart || h.endsWith('.' + hostPart)) && path.startsWith(pathPrefix)) {
        return true
      }
    } else {
      if (h === e || h.endsWith('.' + e)) return true
    }
  }
  return false
}

export function runFilter(
  rawContent: string,
  ctx: FilterContext
): FilterResult {
  const reasons = new Set<FilterReason>()
  const content = rawContent
  const lower = content.toLowerCase()

  // --- Crypto addresses ---
  for (const pat of FILTER_CONFIG.cryptoPatterns) {
    if (pat.test(content)) {
      reasons.add(FILTER_REASONS.CRYPTO_ADDRESS)
      break
    }
  }

  // --- URL-based checks ---
  const urls = extractUrls(content)

  for (const url of urls) {
    if (urlMatchesPaymentList(url)) {
      reasons.add(FILTER_REASONS.PAYMENT_LINK)
    }
    if (hostMatchesList(url.hostname, FILTER_CONFIG.spamDomains)) {
      reasons.add(FILTER_REASONS.SPAM_DOMAIN)
    }
    for (const key of FILTER_CONFIG.affiliateParams) {
      if (url.searchParams.has(key)) {
        reasons.add(FILTER_REASONS.AFFILIATE_LINK)
        break
      }
    }
  }

  // --- Promotional language ---
  for (const phrase of FILTER_CONFIG.promotionalPhrases) {
    if (lower.includes(phrase)) {
      reasons.add(FILTER_REASONS.PROMOTIONAL_LANGUAGE)
      break
    }
  }

  // --- Duplicate content ---
  if (ctx.recentNormalisedPosts.length > 0) {
    const mine = normaliseContent(rawContent)
    const copies = ctx.recentNormalisedPosts.filter((p) => p === mine).length
    if (copies >= FILTER_CONFIG.duplicateMaxCopies) {
      reasons.add(FILTER_REASONS.DUPLICATE_CONTENT)
    }
  }

  // --- New account, many links ---
  if (
    ctx.authorAccountAgeDays !== null &&
    ctx.authorAccountAgeDays < FILTER_CONFIG.newAccountDays &&
    urls.length > FILTER_CONFIG.newAccountMaxLinks
  ) {
    reasons.add(FILTER_REASONS.NEW_ACCOUNT_MANY_LINKS)
  }

  const reasonList = Array.from(reasons)
  return { held: reasonList.length > 0, reasons: reasonList }
}
