export type ProjectLink = {
  label: string
  url: string
}

export const MAX_PROJECT_LINKS = 10
const MAX_LABEL = 100
const MAX_URL = 1000

// Parses link_url_N and link_label_N entries out of a form submission,
// normalises them (adds https://, drops empty rows), validates each,
// and returns a clean array ready to persist. Throws if anything is
// obviously malformed.
export function parseLinksFromFormData(formData: FormData): ProjectLink[] {
  const links: ProjectLink[] = []
  for (let i = 0; i < MAX_PROJECT_LINKS; i++) {
    const rawUrl = (formData.get(`link_url_${i}`) as string | null)?.trim()
    const rawLabel = (formData.get(`link_label_${i}`) as string | null)?.trim()
    if (!rawUrl) continue

    const normalisedUrl = normaliseUrl(rawUrl)
    if (!normalisedUrl) {
      throw new Error(
        `Link ${i + 1}: ${rawUrl} does not look like a valid web address.`
      )
    }
    if (normalisedUrl.length > MAX_URL) {
      throw new Error(`Link ${i + 1}: URL is too long.`)
    }

    const label = (rawLabel && rawLabel.length > 0 ? rawLabel : hostOf(normalisedUrl)).slice(
      0,
      MAX_LABEL
    )

    links.push({ label, url: normalisedUrl })
  }
  return links
}

// Adds https:// if missing and confirms the result parses as an http(s)
// URL. Returns null for anything that isn't a plausible web link.
function normaliseUrl(raw: string): string | null {
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  try {
    const u = new URL(withScheme)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    if (!u.hostname.includes('.')) return null
    return u.toString()
  } catch {
    return null
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

// Validates an array of stored links coming back from the database.
// Never throws — malformed entries are dropped so a bad row can't
// crash a page render.
export function coerceStoredLinks(value: unknown): ProjectLink[] {
  if (!Array.isArray(value)) return []
  const out: ProjectLink[] = []
  for (const entry of value) {
    if (
      entry &&
      typeof entry === 'object' &&
      typeof (entry as { url?: unknown }).url === 'string' &&
      typeof (entry as { label?: unknown }).label === 'string'
    ) {
      const url = (entry as { url: string }).url
      const label = (entry as { label: string }).label
      if (url.length > 0 && /^https?:\/\//i.test(url)) {
        out.push({ url, label: label.length > 0 ? label : url })
      }
    }
    if (out.length >= MAX_PROJECT_LINKS) break
  }
  return out
}
