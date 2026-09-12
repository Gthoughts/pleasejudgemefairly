// Geocodes a UK postcode to coordinates via postcodes.io, a free no-key
// API. Used when a meetup is created/edited so the detail page can show a
// small OpenStreetMap without a live lookup on every view.
//
// Never throws: any failure (empty/N/A input, 404, network error, timeout)
// returns null so saving a meetup never crashes. When null is returned the
// caller stores the postcode as-typed with null latitude/longitude.

export async function geocodePostcode(
  postcode: string
): Promise<{ postcode: string; latitude: number; longitude: number } | null> {
  const pc = postcode.trim().toUpperCase()
  if (pc.length === 0 || pc === 'N/A') return null

  try {
    const url = `https://api.postcodes.io/postcodes/${encodeURIComponent(
      pc.replace(/\s+/g, '')
    )}`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (res.status !== 200) return null
    const body = (await res.json()) as {
      result?: { postcode: string; latitude: number; longitude: number } | null
    }
    const result = body.result
    if (
      !result ||
      typeof result.latitude !== 'number' ||
      typeof result.longitude !== 'number'
    ) {
      return null
    }
    return {
      postcode: result.postcode,
      latitude: result.latitude,
      longitude: result.longitude,
    }
  } catch {
    return null
  }
}
