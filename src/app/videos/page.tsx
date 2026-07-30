import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  getActiveCategories,
  getCategoryBySlug,
  getRandomFeed,
  getTopicFeed,
  getOwnVideoVote,
  getOwnWatchState,
  canCurrentUserReport,
} from '@/lib/videos/queries'
import VideosHeader from '@/components/VideosHeader'
import VideoFeedViewer from './VideoFeedViewer'

export const metadata = {
  title: 'Videos — a place for you',
}

// The videos landing page. Two feed modes selected via ?mode= and
// ?category= query params:
//
//   /videos                        -> random feed across all categories
//   /videos?mode=random            -> same
//   /videos?mode=topic&category=X  -> MF-ranked feed for a category
//
// Kept as query params (not nested routes) so tab switching is
// zero-cost and the URL is easy to share.

type SearchParams = {
  mode?: string
  category?: string
  subcategory?: string
}

export default async function VideosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  const mode: 'topic' | 'random' = sp.mode === 'topic' ? 'topic' : 'random'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isSignedIn = !!user

  const categories = await getActiveCategories(supabase)

  const activeCategory = sp.category
    ? await getCategoryBySlug(supabase, sp.category)
    : null

  // Fetch the feed. Topic mode requires a category; if the user
  // clicked "Topic" without picking one, we prompt them.
  let videos: Awaited<ReturnType<typeof getRandomFeed>> = []
  let needsCategoryPick = false
  if (mode === 'topic') {
    if (!activeCategory) {
      needsCategoryPick = true
    } else {
      videos = await getTopicFeed(supabase, {
        categoryId: activeCategory.id,
        subcategoryId: null,
        limit: 20,
      })
    }
  } else {
    videos = await getRandomFeed(supabase, {
      categoryId: activeCategory?.id ?? null,
      limit: 20,
    })
  }

  // Per-video "own state" for the current user, so the player can
  // reflect prior votes and the qualified-view state on mount.
  const perVideoState: Record<
    string,
    {
      canReport: boolean
      ownVote: 'helpful' | 'unhelpful' | null
      qualifiedAlready: boolean
    }
  > = {}

  if (isSignedIn) {
    const canReport = await canCurrentUserReport(supabase)
    await Promise.all(
      videos.map(async (v) => {
        const [vote, watch] = await Promise.all([
          getOwnVideoVote(supabase, v.id),
          getOwnWatchState(supabase, v.id),
        ])
        perVideoState[v.id] = {
          canReport,
          ownVote: vote,
          qualifiedAlready: watch?.qualified ?? false,
        }
      })
    )
  }

  return (
    <>
      <VideosHeader />
      <div className="flex flex-col">
        <div className="border-b border-stone-200 bg-stone-50">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-2">
              <Link
                href={
                  activeCategory
                    ? `/videos?mode=random&category=${activeCategory.slug}`
                    : '/videos?mode=random'
                }
                className={
                  'rounded-full border px-3 py-1 text-sm ' +
                  (mode === 'random'
                    ? 'border-stone-900 bg-stone-900 text-white'
                    : 'border-stone-300 text-stone-700 hover:bg-stone-100')
                }
              >
                Random
              </Link>
              <Link
                href={
                  activeCategory
                    ? `/videos?mode=topic&category=${activeCategory.slug}`
                    : '/videos?mode=topic'
                }
                className={
                  'rounded-full border px-3 py-1 text-sm ' +
                  (mode === 'topic'
                    ? 'border-stone-900 bg-stone-900 text-white'
                    : 'border-stone-300 text-stone-700 hover:bg-stone-100')
                }
              >
                Topic
              </Link>
            </div>
            <Link
              href="/videos/new"
              className="rounded-full bg-emerald-600 px-3 py-1 text-sm font-medium text-white hover:bg-emerald-700"
            >
              + add
            </Link>
          </div>

          <div className="mx-auto max-w-4xl overflow-x-auto px-4 pb-3 sm:px-6">
            <div className="flex gap-2">
              <Link
                href={`/videos?mode=${mode}`}
                className={
                  'shrink-0 rounded-full border px-3 py-1 text-xs ' +
                  (!activeCategory
                    ? 'border-stone-700 bg-stone-100'
                    : 'border-stone-200 text-stone-600 hover:bg-stone-100')
                }
              >
                All
              </Link>
              {categories.map((c) => (
                <Link
                  key={c.id}
                  href={`/videos?mode=${mode}&category=${c.slug}`}
                  className={
                    'shrink-0 rounded-full border px-3 py-1 text-xs ' +
                    (activeCategory?.id === c.id
                      ? 'border-stone-700 bg-stone-100'
                      : 'border-stone-200 text-stone-600 hover:bg-stone-100')
                  }
                >
                  {c.name}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {needsCategoryPick ? (
          <div className="mx-auto max-w-md p-8 text-center text-stone-600">
            Pick a category above to see its ranked feed.
          </div>
        ) : (
          <VideoFeedViewer
            videos={videos}
            isSignedIn={isSignedIn}
            perVideoState={perVideoState}
          />
        )}
      </div>
    </>
  )
}
