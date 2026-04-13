// The six library categories at launch. Mirrors the pattern in
// src/lib/categories.ts for discussion categories.
export const LIBRARY_CATEGORIES = [
  { slug: 'original-sources', name: 'Original sources' },
  { slug: 'books', name: 'Books' },
  { slug: 'documentaries-and-films', name: 'Documentaries and films' },
  { slug: 'articles-and-essays', name: 'Articles and essays' },
  { slug: 'practical-knowledge', name: 'Practical knowledge' },
  { slug: 'local-and-community', name: 'Local and community' },
] as const

export type LibraryCategorySlug = (typeof LIBRARY_CATEGORIES)[number]['slug']

export function getLibraryCategory(slug: string) {
  return LIBRARY_CATEGORIES.find((c) => c.slug === slug)
}
