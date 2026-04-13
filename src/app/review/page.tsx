import Link from 'next/link'
import DiscussHeader from '@/components/DiscussHeader'
import SiteFooter from '@/components/SiteFooter'
import { createClient } from '@/lib/supabase/server'
import { formatWhen } from '@/lib/format'
import { isAdminEmail } from '@/lib/admin'
import {
  releaseHeldPostAdminAction,
  releaseHeldResourceAdminAction,
  confirmBrokenLinkAction,
} from './actions'

export const metadata = {
  title: 'Review queue — pleasejudgemefairly',
}

// The review queue shows:
//   1. Posts currently held by the automatic filter.
//   2. Resources currently held by the automatic filter.
//   3. Resources flagged as broken by 3+ users with no admin verdict yet.
//
// Open to anyone - held banners are social signals, not secrets.
// Admins get extra action buttons for early release and link confirmation.
export default async function ReviewPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const userIsAdmin = isAdminEmail(user?.email)

  // ------------------------------------------------------------------
  // Held posts
  // ------------------------------------------------------------------
  const { data: heldPosts } = await supabase
    .from('posts')
    .select(
      'id, content, created_at, hold_reasons, hold_expires_at, thread_id, author_id, users:author_id(username), threads:thread_id(id, title, category)'
    )
    .eq('hold_state', 'held')
    .order('created_at', { ascending: false })
    .limit(200)
    .returns<
      {
        id: string
        content: string
        created_at: string
        hold_reasons: string[] | null
        hold_expires_at: string | null
        thread_id: string
        author_id: string
        users: { username: string } | null
        threads: { id: string; title: string; category: string } | null
      }[]
    >()

  const postRows = heldPosts ?? []

  // Fetch user-flag counts for held posts (non-auto flags only).
  const postFlagCounts = new Map<string, number>()
  if (postRows.length > 0) {
    const postIds = postRows.map((r) => r.id)
    const { data: flagRows } = await supabase
      .from('flags')
      .select('content_id')
      .eq('content_type', 'post')
      .eq('auto_flagged', false)
      .in('content_id', postIds)
    for (const f of flagRows ?? []) {
      const pid = f.content_id as string
      postFlagCounts.set(pid, (postFlagCounts.get(pid) ?? 0) + 1)
    }
  }

  // ------------------------------------------------------------------
  // Held resources
  // ------------------------------------------------------------------
  const { data: heldResources } = await supabase
    .from('resources')
    .select(
      'id, title, url, description, created_at, hold_reasons, hold_expires_at, category, users:submitter_id(username)'
    )
    .eq('hold_state', 'held')
    .order('created_at', { ascending: false })
    .limit(200)
    .returns<
      {
        id: string
        title: string
        url: string
        description: string
        created_at: string
        hold_reasons: string[] | null
        hold_expires_at: string | null
        category: string
        users: { username: string } | null
      }[]
    >()

  const resourceRows = heldResources ?? []

  // ------------------------------------------------------------------
  // Resources flagged as broken (3+ flags, no admin verdict)
  // ------------------------------------------------------------------
  const { data: brokenResources } = await supabase
    .from('resources')
    .select(
      'id, title, url, category, broken_flag_count, users:submitter_id(username)'
    )
    .gte('broken_flag_count', 3)
    .is('broken_confirmed', null)
    .order('broken_flag_count', { ascending: false })
    .limit(100)
    .returns<
      {
        id: string
        title: string
        url: string
        category: string
        broken_flag_count: number
        users: { username: string } | null
      }[]
    >()

  const brokenRows = brokenResources ?? []

  return (
    <>
      <DiscussHeader />
      <main className="flex-1 px-6 py-12">
        <div className="mx-auto max-w-2xl space-y-14">
          {/* ----------------------------------------------------------------
              Section 1: Held posts
          ---------------------------------------------------------------- */}
          <section>
            <h1 className="text-2xl font-semibold">Review queue</h1>
            <p className="mt-2 text-sm text-stone-600">
              Posts currently held by the automatic filter. They are
              visible on their threads with a banner. The community can
              read, rate, and flag them normally. Unless they are flagged
              during the hold window, they release automatically after 24
              hours.
            </p>
            {!userIsAdmin && (
              <p className="mt-2 text-xs text-stone-500">
                Admin release is gated by the ADMIN_EMAIL environment
                variable. The current admin contact is documented in the
                README.
              </p>
            )}

            {postRows.length === 0 ? (
              <p className="mt-6 text-sm text-stone-500">
                No posts held. The filter has not matched anything recently.
              </p>
            ) : (
              <ul className="mt-6 divide-y divide-stone-200 border-y border-stone-200">
                {postRows.map((r) => (
                  <li key={r.id} className="py-5">
                    <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-stone-500">
                      <span className="font-medium text-stone-700">
                        {r.users?.username ?? 'unknown'}
                      </span>
                      <span>·</span>
                      <time dateTime={r.created_at}>
                        submitted {formatWhen(r.created_at)}
                      </time>
                      {r.hold_expires_at && (
                        <>
                          <span>·</span>
                          <span>
                            auto-release at {formatWhen(r.hold_expires_at)}
                          </span>
                        </>
                      )}
                    </div>

                    {r.hold_reasons && r.hold_reasons.length > 0 && (
                      <p className="mt-1 text-xs text-amber-800">
                        reasons: {r.hold_reasons.join(', ')}
                      </p>
                    )}
                    {(postFlagCounts.get(r.id) ?? 0) > 0 && (
                      <p className="mt-1 text-xs text-red-700">
                        {postFlagCounts.get(r.id)}{' '}
                        {postFlagCounts.get(r.id) === 1
                          ? 'user report'
                          : 'user reports'}
                      </p>
                    )}

                    <p className="mt-2 whitespace-pre-wrap text-sm text-stone-800">
                      {r.content.length > 500
                        ? r.content.slice(0, 500) + '…'
                        : r.content}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                      {r.threads && (
                        <Link
                          href={`/discuss/${r.threads.category}/${r.threads.id}`}
                          className="text-stone-600 hover:text-stone-900 hover:underline"
                        >
                          View in thread
                        </Link>
                      )}
                      {userIsAdmin && (
                        <form
                          action={releaseHeldPostAdminAction}
                          className="inline"
                        >
                          <input type="hidden" name="post_id" value={r.id} />
                          <button
                            type="submit"
                            className="rounded border border-stone-300 bg-white px-2 py-1 text-xs text-stone-700 hover:border-stone-500 hover:text-stone-900"
                          >
                            Release now (admin)
                          </button>
                        </form>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ----------------------------------------------------------------
              Section 2: Held resources
          ---------------------------------------------------------------- */}
          <section>
            <h2 className="text-xl font-semibold">Held resources</h2>
            <p className="mt-2 text-sm text-stone-600">
              Library resources held by the automatic filter. Same rules as
              held posts: visible with a banner, auto-release after 24 hours
              unless flagged.
            </p>

            {resourceRows.length === 0 ? (
              <p className="mt-6 text-sm text-stone-500">
                No resources held.
              </p>
            ) : (
              <ul className="mt-6 divide-y divide-stone-200 border-y border-stone-200">
                {resourceRows.map((r) => (
                  <li key={r.id} className="py-5">
                    <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-stone-500">
                      <span className="font-medium text-stone-700">
                        {r.users?.username ?? 'unknown'}
                      </span>
                      <span>·</span>
                      <time dateTime={r.created_at}>
                        submitted {formatWhen(r.created_at)}
                      </time>
                      {r.hold_expires_at && (
                        <>
                          <span>·</span>
                          <span>
                            auto-release at {formatWhen(r.hold_expires_at)}
                          </span>
                        </>
                      )}
                    </div>

                    {r.hold_reasons && r.hold_reasons.length > 0 && (
                      <p className="mt-1 text-xs text-amber-800">
                        reasons: {r.hold_reasons.join(', ')}
                      </p>
                    )}

                    <p className="mt-2 text-sm font-medium text-stone-800">
                      {r.title}
                    </p>
                    <p className="mt-0.5 text-xs text-stone-500 break-all">
                      {r.url}
                    </p>
                    {r.description && (
                      <p className="mt-1 text-sm text-stone-700">
                        {r.description.length > 300
                          ? r.description.slice(0, 300) + '…'
                          : r.description}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                      <Link
                        href={`/library/${r.category}/${r.id}`}
                        className="text-stone-600 hover:text-stone-900 hover:underline"
                      >
                        View resource
                      </Link>
                      {userIsAdmin && (
                        <form
                          action={releaseHeldResourceAdminAction}
                          className="inline"
                        >
                          <input
                            type="hidden"
                            name="resource_id"
                            value={r.id}
                          />
                          <button
                            type="submit"
                            className="rounded border border-stone-300 bg-white px-2 py-1 text-xs text-stone-700 hover:border-stone-500 hover:text-stone-900"
                          >
                            Release now (admin)
                          </button>
                        </form>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ----------------------------------------------------------------
              Section 3: Broken-link reports awaiting admin verdict
          ---------------------------------------------------------------- */}
          <section>
            <h2 className="text-xl font-semibold">Broken link reports</h2>
            <p className="mt-2 text-sm text-stone-600">
              Resources flagged as broken by 3 or more users with no admin
              verdict yet. Admin can confirm broken (keeps warning visible) or
              confirm working (clears the warning).
            </p>

            {brokenRows.length === 0 ? (
              <p className="mt-6 text-sm text-stone-500">
                No broken-link reports awaiting review.
              </p>
            ) : (
              <ul className="mt-6 divide-y divide-stone-200 border-y border-stone-200">
                {brokenRows.map((r) => (
                  <li key={r.id} className="py-5">
                    <p className="text-sm font-medium text-stone-800">
                      {r.title}
                    </p>
                    <p className="mt-0.5 text-xs text-stone-500 break-all">
                      {r.url}
                    </p>
                    <p className="mt-1 text-xs text-orange-700">
                      {r.broken_flag_count}{' '}
                      {r.broken_flag_count === 1
                        ? 'user flagged this link as broken'
                        : 'users flagged this link as broken'}
                    </p>
                    <p className="mt-0.5 text-xs text-stone-500">
                      submitted by {r.users?.username ?? 'unknown'}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                      <Link
                        href={`/library/${r.category}/${r.id}`}
                        className="text-stone-600 hover:text-stone-900 hover:underline"
                      >
                        View resource
                      </Link>
                      {userIsAdmin && (
                        <>
                          <form
                            action={confirmBrokenLinkAction}
                            className="inline"
                          >
                            <input
                              type="hidden"
                              name="resource_id"
                              value={r.id}
                            />
                            <input
                              type="hidden"
                              name="confirmed"
                              value="true"
                            />
                            <button
                              type="submit"
                              className="rounded border border-orange-300 bg-white px-2 py-1 text-xs text-orange-700 hover:border-orange-500 hover:text-orange-900"
                            >
                              Confirm broken (admin)
                            </button>
                          </form>
                          <form
                            action={confirmBrokenLinkAction}
                            className="inline"
                          >
                            <input
                              type="hidden"
                              name="resource_id"
                              value={r.id}
                            />
                            <input
                              type="hidden"
                              name="confirmed"
                              value="false"
                            />
                            <button
                              type="submit"
                              className="rounded border border-stone-300 bg-white px-2 py-1 text-xs text-stone-700 hover:border-stone-500 hover:text-stone-900"
                            >
                              Confirm working (admin)
                            </button>
                          </form>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
