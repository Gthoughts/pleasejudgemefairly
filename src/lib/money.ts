// Money helpers. All money is stored as integer PENCE (£15.00 = 1500) to
// avoid floating-point errors. Prefix values with £ at call sites, not here.

// Parses a user-entered string like "15", "15.50" or "£15" into integer
// pence. Returns null if the input is empty, invalid or negative.
export function poundsToPence(input: FormDataEntryValue | string | null): number | null {
  if (typeof input !== 'string') return null
  const cleaned = input.trim().replace(/^£/, '').trim()
  if (cleaned.length === 0) return null
  // Allow digits with an optional decimal part of up to two places.
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null
  const pounds = Number(cleaned)
  if (!isFinite(pounds) || pounds < 0) return null
  return Math.round(pounds * 100)
}

// Formats pence into a pounds string: 1500 -> "15" and 1550 -> "15.50".
// No trailing .00; pennies shown only when non-zero.
export function penceToPounds(pence: number): string {
  const pounds = pence / 100
  return pence % 100 === 0 ? String(Math.trunc(pounds)) : pounds.toFixed(2)
}
