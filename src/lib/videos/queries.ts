// Server-side data loaders for the videos feature. All functions
// here are called from server components / actions and use the
// cookie-scoped Supabase client. RLS handles visibility (unpublished
// videos never returned, held videos hidden from feeds, etc).
//
// Never select videos.uploader_id here. Uploader identity is
// deliberately not exposed to the UI. If we ever need it for
// moderation, use the service-role client in a dedicated admin
// loader.

import type { createClient } from '@/lib/supabase/server'
import { RANKING_MIN_QUALIFIED_VIEWS } from './watch'
import type { VideoCategory, VideoSubcategory } from './categories'

type ServerClient = Awaited<ReturnType<typeof createClient>>

// The shape returned to the feed / player. Deliberately excludes
// uploader_id, hold_reasons, is_unpublished, released_by, and any
// other moderator-facing columns.
export interface FeedVideo {
  id: string
  source_type: 'external' | 'upload'
  external_url: string | null
  external_platform: string | null
  storage_ref: string | null
  title: string
  description: string | null
  duration_seconds: number | null
  aspect_ratio: 'portrait' | 'landscape' | 'square' | null
  category_id: string
  subcategory_id: string | null
  qualified_views: number
  helpfulness_score: number | null
  rating_count: number
  created_at: string
}

const FEED_SELECT =
  'id, source_type, external_url, external_platform, storage_ref, ' +
  'title, description, duration_seconds, aspect_ratio, ' +
  'category_id, subcategory_id, qualified_views, ' +
  'helpfulness_score, rating_count, created_at'

// ------------------------------------------------------------------
// Category loaders
// ------------------------------------------------------------------

export async function getActiveCategories(
  supabase: ServerClient
): Promise<VideoCategory[]> {
  const { data, error } = await supabase
    .from('video_categories')
    .select('id, slug, name, status, sort_order, created_by')
    .eq('status', 'active')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as VideoCategory[]
}

export async function getCategoryBySlug(
  supabase: ServerClient,
  slug: string
): Promise<VideoCategory | null> {
  const { data } = await supabase
    .from('video_categories')
    .select('id, slug, name, status, sort_order, created_by')
    .eq('slug', slug)
    .maybeSingle<VideoCategory>()
  return data ?? null
}

export async function getActiveSubcategoriesForCategory(
  supabase: ServerClient,
  categoryId: string
): Promise<VideoSubcategory[]> {
  const { data, error } = await supabase
    .from('video_subcategories')
    .select('id, category_id, slug, name, status, sort_order, created_by')
    .eq('category_id', categoryId)
    .eq('status', 'active')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as VideoSubcategory[]
}

export async function getSubcategoryBySlug(
  supabase: ServerClient,
  categoryId: string,
  slug: string
): Promise<VideoSubcategory | null> {
  const { data } = await supabase
    .from('video_subcategories')
    .select('id, category_id, slug, name, status, sort_order, created_by')
    .eq('category_id', categoryId)
    .eq('slug', slug)
    .maybeSingle<VideoSubcategory>()
  return data ?? null
}

// ------------------------------------------------------------------
// Feed loaders
// ------------------------------------------------------------------

// Topic feed: MF-ranked, filtered to a category (and optionally a
// subcategory), only videos that have warmed up past the qualified-
// views threshold, no held or collapsed or unpublished videos.
// RLS on the videos table filters unpublished; explicit filters here
// keep held and collapsed videos out too.
export async function getTopicFeed(
  supabase: ServerClient,
  opts: {
    categoryId: string
    subcategoryId?: string | null
    limit?: number
    beforeScore?: number | null // for cursor pagination
  }
): Promise<FeedVideo[]> {
  let q = supabase
    .from('videos')
    .select(FEED_SELECT)
    .eq('category_id', opts.categoryId)
    .eq('hold_state', 'none')
    .eq('is_collapsed', false)
    .gte('qualified_views', RANKING_MIN_QUALIFIED_VIEWS)
    .order('helpfulness_score', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 20)
  if (opts.subcategoryId) q = q.eq('subcategory_id', opts.subcategoryId)
  if (opts.beforeScore != null)
    q = q.lt('helpfulness_score', opts.beforeScore)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as FeedVideo[]
}

// Random feed: pure random, no ranking, no warm-up threshold.
// Optionally filtered to a category / subcategory. This is where
// new uploads live before they warm up.
//
// Fetches 5x the target limit and shuffles in JS. Cheap at low
// scale; if the table grows past ~10k videos, switch to a Postgres
// RPC using TABLESAMPLE SYSTEM_ROWS.
export async function getRandomFeed(
  supabase: ServerClient,
  opts: {
    categoryId?: string | null
    subcategoryId?: string | null
    limit?: number
  }
): Promise<FeedVideo[]> {
  const target = opts.limit ?? 20
  let q = supabase
    .from('videos')
    .select(FEED_SELECT)
    .eq('hold_state', 'none')
    .eq('is_collapsed', false)
    .limit(target * 5)
  if (opts.categoryId) q = q.eq('category_id', opts.categoryId)
  if (opts.subcategoryId) q = q.eq('subcategory_id', opts.subcategoryId)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  const shuffled = [...(data ?? [])].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, target) as unknown as FeedVideo[]
}

// ------------------------------------------------------------------
// Single video loader (for /videos/[videoId] and swipe-up comments)
// ------------------------------------------------------------------

export async function getVideoById(
  supabase: ServerClient,
  id: string
): Promise<FeedVideo | null> {
  const { data } = await supabase
    .from('videos')
    .select(FEED_SELECT)
    .eq('id', id)
    .maybeSingle<FeedVideo>()
  return data ?? null
}

// ------------------------------------------------------------------
// Video comments (video_posts) loader
// ------------------------------------------------------------------

export interface VideoComment {
  id: string
  video_id: string
  parent_post_id: string | null
  author_id: string
  author_username: string
  content: string
  helpfulness_score: number | null
  rating_count: number
  is_collapsed: boolean
  hold_state: 'none' | 'held' | 'released'
  created_at: string
  updated_at: string
}

// One flat list ordered by score desc then created_at asc. The UI
// reassembles the tree by parent_post_id. Kept flat because a video
// won't have thousands of comments at first; if it does we'll add
// pagination and lazy child loading later.
export async function getVideoComments(
  supabase: ServerClient,
  videoId: string
): Promise<VideoComment[]> {
  const { data, error } = await supabase
    .from('video_posts')
    .select(
      'id, video_id, parent_post_id, author_id, content, ' +
        'helpfulness_score, rating_count, is_collapsed, hold_state, ' +
        'created_at, updated_at, ' +
        'author:users!video_posts_author_id_fkey(username)'
    )
    .eq('video_id', videoId)
    .order('helpfulness_score', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => {
    const r = row as unknown as {
      id: string
      video_id: string
      parent_post_id: string | null
      author_id: string
      content: string
      helpfulness_score: number | null
      rating_count: number
      is_collapsed: boolean
      hold_state: 'none' | 'held' | 'released'
      created_at: string
      updated_at: string
      author: { username: string } | null
    }
    return {
      id: r.id,
      video_id: r.video_id,
      parent_post_id: r.parent_post_id,
      author_id: r.author_id,
      author_username: r.author?.username ?? 'unknown',
      content: r.content,
      helpfulness_score: r.helpfulness_score,
      rating_count: r.rating_count,
      is_collapsed: r.is_collapsed,
      hold_state: r.hold_state,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }
  })
}

// ------------------------------------------------------------------
// Watch state loader (used by the player to know if the current user
// has already crossed the vote gate for this video)
// ------------------------------------------------------------------

export async function getOwnWatchState(
  supabase: ServerClient,
  videoId: string
): Promise<{ watchedPercent: number; qualified: boolean } | null> {
  const { data } = await supabase
    .from('video_views')
    .select('watched_percent, first_qualified_at')
    .eq('video_id', videoId)
    .maybeSingle<{
      watched_percent: number
      first_qualified_at: string | null
    }>()
  if (!data) return { watchedPercent: 0, qualified: false }
  return {
    watchedPercent: Number(data.watched_percent),
    qualified: data.first_qualified_at !== null,
  }
}

// ------------------------------------------------------------------
// Own vote loader (so the UI can show which way the current user
// swiped last time). Reads own rating only via RLS.
// ------------------------------------------------------------------

export async function getOwnVideoVote(
  supabase: ServerClient,
  videoId: string
): Promise<'helpful' | 'unhelpful' | null> {
  const { data } = await supabase
    .from('ratings')
    .select('rating')
    .eq('content_type', 'video')
    .eq('content_id', videoId)
    .maybeSingle<{ rating: 'helpful' | 'unhelpful' }>()
  return data?.rating ?? null
}

// ------------------------------------------------------------------
// Report privilege check for the current user
// ------------------------------------------------------------------

export async function canCurrentUserReport(
  supabase: ServerClient
): Promise<boolean> {
  const { data } = await supabase.rpc('can_report_video')
  return data === true
}
