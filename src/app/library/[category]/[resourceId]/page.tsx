import Link from 'next/link'
import { notFound } from 'next/navigation'
import LibraryHeader from '@/components/LibraryHeader'
import SiteFooter from '@/components/SiteFooter'
import { createClient } from '@/lib/supabase/server'
import { getLibraryCategory } from '@/lib/library-categories'
import { formatWhen } from '@/lib/format'
import ResourceRatingButtons from './ResourceRatingButtons'
import BrokenLinkButton from './BrokenLinkButton'

export default async function ResourcePage(
  props: PageProps<'/library/[category]/[resourceId]'>
) {
  const { category, resourceId } = await props.params
  const cat = getLibraryCategory(category)
  if (!cat) notFound()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: resource } = await supabase
    .from('resources')
    .select(
      'id, title, url, description, created_at, hold_state, hold_reasons, is_collapsed, broken_flag_count, broken_confirmed, users:submitter_id(username)'
    )
    .eq('id', resourceId)
    .eq('category', category)
    .maybeSingle<{
      id: string
      title: string
      url: string
      description: string
      created_at: string
      hold_state: string
      hold_reasons: string[] | null
      is_collapsed: boolean
      broken_flag_count: number
      broken_confirmed: boolean | null
      users: { username: string } | null
    }>()

  if (!resource) notFound()

  const redirectTo = `/library/${category}/${resourceId}`

  // Fetch the current user's own rating (if any) and broken-link flag.
  let myRating: 'helpful' | 'unhelpful' | null = null
  let alreadyFlagged = false

  if (user) {
    const [{ data: ratingRow }, { count: flagCount }] = await Promise.all([
      supabase
        .from('ratings')
        .select('rating')
        .eq('user_id', user.id)
        .eq('content_type', 'resource')
        .eq('content_id', resourceId)
        .maybeSingle<{ rating: 'helpful' | 'unhelpful' }>(),
      supabase
        .from('flags')
        .select('id', { count: 'exact', head: true })
        .eq('content_type', 'resource')
        .eq('content_id', resourceId)
        .eq('reason', 'broken_link')
        .eq('reporter_id', user.id),
    ])
    myRating = ratingRow?.rating ?? null
    alreadyFlagged = (flagCount ?? 0) > 0
  }

  const isHeld = resource.hold_state === 'held'
  const maybeBroken =
    resource.broken_confirmed === true ||
    (resource.broken_flag_count >= 3 && resource.broken_confirmed !== false)

  return (
    <>
      <LibraryHeader />
      <main className="flex-1 px-6 py-12">
        <div className="mx-auto max-w-2xl">
          <p className="text-sm text-stone-500">
            <Link
              href={`/library/${category}`}
              className="underline hover:text-stone-900"
            >
              ← {cat.name}
            </Link>
          </p>

          {resource.is_collapsed && (
            <div
              role="note"
              className="mt-4 rounded border border-dashed border-stone-300 bg-stone-50 px-4 py-3 text-sm text-stone-500"
            >
              This resource has been collapsed by community ratings. It is still
              visible here for reference.
            </div>
          )}

          {isHeld && (
            <div
              role="note"
              className="mt-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900"
            >
              <span className="font-medium">Held for review.</span>{' '}
              The automatic filter matched this resource against the
              no-money-making rule. It is visible while the community decides.
              {resource.hold_reasons && resource.hold_reasons.length > 0 && (
                <span className="ml-1 text-amber-800">
                  ({resource.hold_reasons.join(', ')})
                </span>
              )}
            </div>
          )}

          {maybeBroken && (
            <div className="mt-4 rounded border border-orange-300 bg-orange-50 px-3 py-2 text-xs text-orange-900">
              {resource.broken_confirmed === true
                ? 'Link confirmed broken by admin.'
                : `This link may be broken — flagged by ${resource.broken_flag_count} ${resource.broken_flag_count === 1 ? 'user' : 'users'}.`}
            </div>
          )}

          <h1 className="mt-4 text-2xl font-semibold">{resource.title}</h1>

          <p className="mt-1 text-sm text-stone-500">
            submitted by{' '}
            <span className="font-medium text-stone-700">
              {resource.users?.username ?? 'unknown'}
            </span>
            <span className="mx-1">·</span>
            <time dateTime={resource.created_at}>
              {formatWhen(resource.created_at)}
            </time>
          </p>

          <a
            href={resource.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block rounded border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 hover:border-stone-500 hover:text-stone-900 break-all"
          >
            {resource.url}
          </a>

          <p className="mt-4 whitespace-pre-wrap text-sm text-stone-800">
            {resource.description}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
            {user ? (
              <>
                <ResourceRatingButtons
                  resourceId={resource.id}
                  initialRating={myRating}
                  redirectTo={redirectTo}
                />
                <BrokenLinkButton
                  resourceId={resource.id}
                  redirectTo={redirectTo}
                  alreadyFlagged={alreadyFlagged}
                />
              </>
            ) : (
              <p className="text-xs text-stone-500">
                <Link
                  href={`/signin?next=${redirectTo}`}
                  className="underline hover:text-stone-800"
                >
                  Sign in
                </Link>{' '}
                to rate or flag this resource.
              </p>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
