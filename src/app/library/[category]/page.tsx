import Link from 'next/link'
import { notFound } from 'next/navigation'
import LibraryHeader from '@/components/LibraryHeader'
import SiteFooter from '@/components/SiteFooter'
import { createClient } from '@/lib/supabase/server'
import { getLibraryCategory } from '@/lib/library-categories'
import { formatWhen } from '@/lib/format'
import { getAdminUserIds, getDisplayUsername } from '@/lib/admin'

type ResourceRow = {
  id: string
  title: string
  url: string
  description: string
  created_at: string
  hold_state: string
  is_collapsed: boolean
  broken_flag_count: number
  broken_confirmed: boolean | null
  rating_count: number
  submitter_id: string
  users: { username: string } | null
}

export async function generateMetadata(
  props: PageProps<'/library/[category]'>
) {
  const { category } = await props.params
  const cat = getLibraryCategory(category)
  if (!cat) return {}
  return { title: `${cat.name} — Library — pleasejudgemefairly` }
}

export default async function LibraryCategoryPage(
  props: PageProps<'/library/[category]'>
) {
  const { category } = await props.params
  const search = await props.searchParams
  const sort = typeof search.sort === 'string' ? search.sort : 'newest'

  const cat = getLibraryCategory(category)
  if (!cat) notFound()

  const supabase = await createClient()

  const { data } = await supabase
    .from('resources')
    .select(
      'id, title, url, description, created_at, hold_state, is_collapsed, broken_flag_count, broken_confirmed, rating_count, submitter_id, users:submitter_id(username)'
    )
    .eq('category', category)
    .order(
      sort === 'rated' ? 'rating_count' : 'created_at',
      { ascending: false, nullsFirst: false }
    )
    .limit(100)
    .returns<ResourceRow[]>()

  const resources = data ?? []
  const adminIds = await getAdminUserIds()

  return (
    <>
      <LibraryHeader />
      <main className="flex-1 px-6 py-12">
        <div className="mx-auto max-w-2xl">
          <p className="text-sm text-stone-500">
            <Link href="/library" className="underline hover:text-stone-900">
              ← Library
            </Link>
          </p>

          <div className="mt-1 flex items-start justify-between gap-4">
            <h1 className="text-2xl font-semibold">{cat.name}</h1>
            <Link
              href={`/library/${category}/new`}
              className="rounded bg-stone-900 text-stone-50 px-4 py-2 text-sm hover:bg-stone-700 shrink-0"
            >
              Submit a resource
            </Link>
          </div>

          <div className="mt-4 flex items-center gap-4 text-sm">
            <span className="text-stone-500">Sort:</span>
            <Link
              href={`/library/${category}`}
              className={
                sort !== 'rated'
                  ? 'font-medium text-stone-900'
                  : 'text-stone-600 hover:underline'
              }
            >
              Newest
            </Link>
            <Link
              href={`/library/${category}?sort=rated`}
              className={
                sort === 'rated'
                  ? 'font-medium text-stone-900'
                  : 'text-stone-600 hover:underline'
              }
            >
              Most rated
            </Link>
          </div>

          {resources.length === 0 ? (
            <p className="mt-10 text-sm text-stone-500">
              No resources yet.{' '}
              <Link
                href={`/library/${category}/new`}
                className="underline hover:text-stone-800"
              >
                Submit the first one.
              </Link>
            </p>
          ) : (
            <ul className="mt-6 divide-y divide-stone-200 border-y border-stone-200">
              {resources.map((r) => {
                if (r.is_collapsed) {
                  return (
                    <li key={r.id} className="py-5">
                      <div className="rounded border border-dashed border-stone-300 bg-stone-50 px-4 py-3 text-sm text-stone-500">
                        resource collapsed by community &middot;{' '}
                        <Link
                          href={`/library/${category}/${r.id}`}
                          className="underline hover:text-stone-800"
                        >
                          view anyway
                        </Link>
                      </div>
                    </li>
                  )
                }

                const maybeBroken =
                  r.broken_confirmed === true ||
                  (r.broken_flag_count >= 3 && r.broken_confirmed !== false)

                return (
                  <li key={r.id} className="py-5">
                    {r.hold_state === 'held' && (
                      <div
                        role="note"
                        className="mb-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900"
                      >
                        <span className="font-medium">Held for review.</span>{' '}
                        This resource matched the automatic filter and is
                        pending community review.
                      </div>
                    )}
                    {maybeBroken && (
                      <div className="mb-2 rounded border border-orange-300 bg-orange-50 px-3 py-2 text-xs text-orange-900">
                        {r.broken_confirmed === true
                          ? 'Link confirmed broken by admin.'
                          : 'This link may be broken — flagged by multiple users.'}
                      </div>
                    )}
                    <Link
                      href={`/library/${category}/${r.id}`}
                      className="font-medium text-stone-800 hover:underline"
                    >
                      {r.title}
                    </Link>
                    <p className="mt-1 text-xs text-stone-500">
                      {getDisplayUsername(r.submitter_id, r.users?.username ?? 'unknown', adminIds)}
                      <span className="mx-1">·</span>
                      <time dateTime={r.created_at}>
                        {formatWhen(r.created_at)}
                      </time>
                    </p>
                    <p className="mt-1 text-sm text-stone-600 line-clamp-2">
                      {r.description}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
