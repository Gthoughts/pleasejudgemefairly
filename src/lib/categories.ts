// The four discussion categories at launch. The slug is what is stored in
// `threads.category` and what appears in URLs; the name is what the user
// sees. Add or rename categories here.
export const CATEGORIES = [
  { slug: 'the-book', name: 'The Book' },
  { slug: 'living-it', name: 'Living It' },
  { slug: 'local', name: 'Local' },
  { slug: 'open', name: 'Open' },
] as const

export type CategorySlug = (typeof CATEGORIES)[number]['slug']

export function getCategory(slug: string) {
  return CATEGORIES.find((c) => c.slug === slug)
}
