// The library categories. Mirrors the pattern in
// src/lib/categories.ts for discussion categories.
export const LIBRARY_CATEGORIES = [
  { slug: 'original-sources', name: 'Original sources' },
  { slug: 'books', name: 'Books' },
  { slug: 'documentaries-and-films', name: 'Documentaries and films' },
  { slug: 'social-media-videos', name: 'Social media videos' },
  { slug: 'articles-and-essays', name: 'Articles and essays' },
  { slug: 'practical-knowledge', name: 'Practical knowledge' },
  { slug: 'local-and-community', name: 'Local and community' },
] as const

export type LibraryCategorySlug = (typeof LIBRARY_CATEGORIES)[number]['slug']

export function getLibraryCategory(slug: string) {
  return LIBRARY_CATEGORIES.find((c) => c.slug === slug)
}

// Platforms shown in the dropdown when submitting under the
// "social-media-videos" category. Keep in sync with isValidPlatform below.
export const SOCIAL_MEDIA_PLATFORMS = [
  { value: 'youtube', label: 'YouTube' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'x', label: 'X (Twitter)' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'vimeo', label: 'Vimeo' },
  { value: 'rumble', label: 'Rumble' },
  { value: 'other', label: 'Other' },
] as const

export type SocialMediaPlatform =
  (typeof SOCIAL_MEDIA_PLATFORMS)[number]['value']

const PLATFORM_VALUES = new Set<string>(
  SOCIAL_MEDIA_PLATFORMS.map((p) => p.value)
)

export function isValidPlatform(v: string): v is SocialMediaPlatform {
  return PLATFORM_VALUES.has(v)
}

export function platformLabel(value: string | null | undefined): string {
  if (!value) return 'Other'
  return SOCIAL_MEDIA_PLATFORMS.find((p) => p.value === value)?.label ?? 'Other'
}

export const SOCIAL_MEDIA_VIDEOS_SLUG = 'social-media-videos'
