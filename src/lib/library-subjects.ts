// Subject taxonomy for library resources. Shared across every
// format (books, articles, docs, etc.) so people can browse
// "everything on History" or "everything on Justice" in one place.

export const LIBRARY_SUBJECTS = [
  { slug: 'history', name: 'History' },
  { slug: 'politics-and-society', name: 'Politics & Society' },
  { slug: 'economics-and-money', name: 'Economics & Money' },
  { slug: 'justice-law-and-rights', name: 'Justice, Law & Rights' },
  { slug: 'philosophy-ethics-and-faith', name: 'Philosophy, Ethics & Faith' },
  { slug: 'community-and-practical-life', name: 'Community & Practical Life' },
  { slug: 'memoir-biography-and-story', name: 'Memoir, Biography & Story' },
  { slug: 'science-and-environment', name: 'Science & Environment' },
  { slug: 'other', name: 'Other' },
] as const

export type LibrarySubjectSlug = (typeof LIBRARY_SUBJECTS)[number]['slug']

const SUBJECT_SLUGS = new Set<string>(LIBRARY_SUBJECTS.map((s) => s.slug))

export function isValidSubject(slug: string): slug is LibrarySubjectSlug {
  return SUBJECT_SLUGS.has(slug)
}

export function getLibrarySubject(slug: string) {
  return LIBRARY_SUBJECTS.find((s) => s.slug === slug)
}

export function subjectLabel(slug: string | null | undefined): string {
  if (!slug) return 'Uncategorised'
  return LIBRARY_SUBJECTS.find((s) => s.slug === slug)?.name ?? 'Uncategorised'
}
