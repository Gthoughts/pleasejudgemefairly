// Video categories are dynamic — they live in the database because
// uploaders can add new ones via the "other" flow. This file holds
// the seeded slugs that the site launches with (must match the seeds
// in supabase/phase19_videos.sql), the small set of pure helpers, and
// the TS types used across the videos routes.
//
// Fetching the full list at request time is the job of a server-side
// data loader; nothing here reads the DB.

export const SEED_CATEGORY_SLUGS = [
  'history',
  'politics',
  'social',
  'community',
  'latest-news',
] as const

export type SeedCategorySlug = (typeof SEED_CATEGORY_SLUGS)[number]

export const CATEGORY_STATUSES = [
  'active',
  'pending_review',
  'renamed',
  'merged',
  'rejected',
] as const

export type CategoryStatus = (typeof CATEGORY_STATUSES)[number]

export interface VideoCategory {
  id: string
  slug: string
  name: string
  status: CategoryStatus
  sort_order: number
  created_by: string | null
}

export interface VideoSubcategory {
  id: string
  category_id: string
  slug: string
  name: string
  status: CategoryStatus
  sort_order: number
  created_by: string | null
}

// Slugify a user-supplied category or subcategory name into a
// URL-safe form. Lowercase, ASCII only, hyphen-separated. Empty
// output means the name was nothing but punctuation; the caller
// should reject the submission in that case.
export function slugifyCategoryName(raw: string): string {
  return raw
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

// Trim, collapse whitespace, and cap length for a human-readable
// category or subcategory display name.
export function normaliseCategoryName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').slice(0, 60)
}
