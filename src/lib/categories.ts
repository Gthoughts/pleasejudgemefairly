// Discussion categories. The slug is what is stored in `threads.category`
// and what appears in URLs; the name is what the user sees. Add or rename
// categories here — no schema changes needed, slugs are plain text in Postgres.
export const CATEGORIES = [
  { slug: 'the-book', name: 'The Book', subtitle: undefined },
  { slug: 'living-it', name: 'Living It', subtitle: undefined },
  { slug: 'local', name: 'Local', subtitle: undefined },
  { slug: 'open', name: 'Open', subtitle: undefined },
  { slug: 'practical', name: 'Practical', subtitle: 'Energy, water, food, shelter' },
  { slug: 'spiritual', name: 'Spiritual', subtitle: undefined },
  { slug: 'ideas', name: 'Ideas', subtitle: undefined },
] as const

export type CategorySlug = (typeof CATEGORIES)[number]['slug']

export function getCategory(slug: string) {
  return CATEGORIES.find((c) => c.slug === slug)
}
