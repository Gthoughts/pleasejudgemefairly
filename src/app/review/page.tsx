import Link from 'next/link'
import { redirect } from 'next/navigation'
import DiscussHeader from '@/components/DiscussHeader'
import SiteFooter from '@/components/SiteFooter'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { formatWhen } from '@/lib/format'
import { isAdminEmail, getAdminUserIds, getDisplayUsername } from '@/lib/admin'
import type { ReportReasonType } from '@/lib/videos/reports'
import {
  releaseHeldPostAdminAction,
  releaseHeldResourceAdminAction,
  confirmBrokenLinkAction,
} from './actions'
import { approveCipherAction, rejectCipherAction } from '../code/actions'
import VideoTaxonomyReviewItem from './VideoTaxonomyReviewItem'
import VideoReportReviewItem from './VideoReportReviewItem'

export const metadata = {
  title: 'Review queue — a place for you',
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
  if (!user) redirect('/signin?next=/review')
  const userIsAdmin = isAdminEmail(user?.email)
  const adminIds = await getAdminUserIds()

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
      'id, title, url, description, created_at, hold_reasons, hold_expires_at, category, submitter_id, users:submitter_id(username)'
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
        submitter_id: string
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
      'id, title, url, category, broken_flag_count, submitter_id, users:submitter_id(username)'
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
        submitter_id: string
        users: { username: string } | null
      }[]
    >()

  const brokenRows = brokenResources ?? []

  // ------------------------------------------------------------------
  // Video taxonomy queue (pending categories + subcategories)
  // Admin-only; service role reads because we cross into other users'
  // data (username lookups, video counts).
  // ------------------------------------------------------------------

  type TaxonomyItem = {
    id: string
    slug: string
    name: string
    createdAt: string
    createdBy: string | null
    createdByUsername: string | null
    parentCategoryName?: string
    videoCount: number
    mergeTargets: { id: string; name: string; slug: string }[]
  }

  let pendingCategoryItems: TaxonomyItem[] = []
  let pendingSubcategoryItems: TaxonomyItem[] = []
  let pendingReportItems: {
    reportId: string
    videoId: string
    videoTitle: string
    reasonType: ReportReasonType
    note: string | null
    reporterUsername: string | null
    reporterWarningsSoFar: number
    reporterRevoked: boolean
    createdAt: string
    otherPendingCount: number
  }[] = []

  if (userIsAdmin) {
    const service = createServiceClient()

    // --- Categories ---
    const { data: pCats } = await service
      .from('video_categories')
      .select('id, slug, name, created_at, created_by')
      .eq('status', 'pending_review')
      .order('created_at', { ascending: true })
      .returns<
        {
          id: string
          slug: string
          name: string
          created_at: string
          created_by: string | null
        }[]
      >()
    const catRows = pCats ?? []

    const { data: activeCats } = await service
      .from('video_categories')
      .select('id, slug, name')
      .eq('status', 'active')
      .order('name', { ascending: true })
      .returns<{ id: string; name: string; slug: string }[]>()

    const catUsernames = new Map<string, string>()
    const catUserIds = catRows.map((c) => c.created_by).filter(Boolean) as string[]
    if (catUserIds.length > 0) {
      const { data: uRows } = await service
        .from('users')
        .select('id, username')
        .in('id', catUserIds)
        .returns<{ id: string; username: string }[]>()
      for (const u of uRows ?? []) catUsernames.set(u.id, u.username)
    }

    const catVideoCounts = new Map<string, number>()
    if (catRows.length > 0) {
      const { data: vRows } = await service
        .from('videos')
        .select('id, category_id')
        .in('id', []) // placeholder to keep the type
        .returns<{ id: string; category_id: string }[]>()
      void vRows
      // Cheaper: count per category individually since Postgres
      // group_by via supabase-js needs an RPC. Small N.
      for (const c of catRows) {
        const { count } = await service
          .from('videos')
          .select('id', { count: 'exact', head: true })
          .eq('category_id', c.id)
        catVideoCounts.set(c.id, count ?? 0)
      }
    }

    pendingCategoryItems = catRows.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      createdAt: c.created_at,
      createdBy: c.created_by,
      createdByUsername: c.created_by
        ? (catUsernames.get(c.created_by) ?? null)
        : null,
      videoCount: catVideoCounts.get(c.id) ?? 0,
      mergeTargets: (activeCats ?? []).filter((a) => a.id !== c.id),
    }))

    // --- Subcategories ---
    const { data: pSubs } = await service
      .from('video_subcategories')
      .select('id, slug, name, category_id, created_at, created_by')
      .eq('status', 'pending_review')
      .order('created_at', { ascending: true })
      .returns<
        {
          id: string
          slug: string
          name: string
          category_id: string
          created_at: string
          created_by: string | null
        }[]
      >()
    const subRows = pSubs ?? []

    const parentCatIds = Array.from(new Set(subRows.map((s) => s.category_id)))
    const parentCatById = new Map<string, string>()
    if (parentCatIds.length > 0) {
      const { data: pcRows } = await service
        .from('video_categories')
        .select('id, name')
        .in('id', parentCatIds)
        .returns<{ id: string; name: string }[]>()
      for (const c of pcRows ?? []) parentCatById.set(c.id, c.name)
    }

    // Active peers for merge target, per parent category.
    const peersByCat = new Map<
      string,
      { id: string; name: string; slug: string }[]
    >()
    if (parentCatIds.length > 0) {
      const { data: peerRows } = await service
        .from('video_subcategories')
        .select('id, name, slug, category_id')
        .eq('status', 'active')
        .in('category_id', parentCatIds)
        .returns<
          { id: string; name: string; slug: string; category_id: string }[]
        >()
      for (const p of peerRows ?? []) {
        const arr = peersByCat.get(p.category_id) ?? []
        arr.push({ id: p.id, name: p.name, slug: p.slug })
        peersByCat.set(p.category_id, arr)
      }
    }

    const subUsernames = new Map<string, string>()
    const subUserIds = subRows.map((s) => s.created_by).filter(Boolean) as string[]
    if (subUserIds.length > 0) {
      const { data: uRows } = await service
        .from('users')
        .select('id, username')
        .in('id', subUserIds)
        .returns<{ id: string; username: string }[]>()
      for (const u of uRows ?? []) subUsernames.set(u.id, u.username)
    }

    const subVideoCounts = new Map<string, number>()
    for (const s of subRows) {
      const { count } = await service
        .from('videos')
        .select('id', { count: 'exact', head: true })
        .eq('subcategory_id', s.id)
      subVideoCounts.set(s.id, count ?? 0)
    }

    pendingSubcategoryItems = subRows.map((s) => ({
      id: s.id,
      slug: s.slug,
      name: s.name,
      createdAt: s.created_at,
      createdBy: s.created_by,
      createdByUsername: s.created_by
        ? (subUsernames.get(s.created_by) ?? null)
        : null,
      parentCategoryName: parentCatById.get(s.category_id) ?? '',
      videoCount: subVideoCounts.get(s.id) ?? 0,
      mergeTargets:
        (peersByCat.get(s.category_id) ?? []).filter((p) => p.id !== s.id),
    }))

    // --- Reports queue ---
    const { data: reports } = await service
      .from('video_reports')
      .select('id, video_id, reporter_id, reason_type, note, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .returns<
        {
          id: string
          video_id: string
          reporter_id: string
          reason_type: ReportReasonType
          note: string | null
          created_at: string
        }[]
      >()
    const rRows = reports ?? []

    const reportVideoIds = Array.from(new Set(rRows.map((r) => r.video_id)))
    const videoTitles = new Map<string, string>()
    if (reportVideoIds.length > 0) {
      const { data: vRows } = await service
        .from('videos')
        .select('id, title')
        .in('id', reportVideoIds)
        .returns<{ id: string; title: string }[]>()
      for (const v of vRows ?? []) videoTitles.set(v.id, v.title)
    }

    const reporterIds = Array.from(new Set(rRows.map((r) => r.reporter_id)))
    const reporterMap = new Map<
      string,
      { username: string; warnings: number; revoked: boolean }
    >()
    if (reporterIds.length > 0) {
      const { data: uRows } = await service
        .from('users')
        .select(
          'id, username, video_report_warnings, video_report_privilege_revoked_at'
        )
        .in('id', reporterIds)
        .returns<
          {
            id: string
            username: string
            video_report_warnings: number
            video_report_privilege_revoked_at: string | null
          }[]
        >()
      for (const u of uRows ?? []) {
        reporterMap.set(u.id, {
          username: u.username,
          warnings: u.video_report_warnings ?? 0,
          revoked: u.video_report_privilege_revoked_at !== null,
        })
      }
    }

    // Count how many OTHER pending reports each video has, so the
    // admin knows if their verdict is one of several coming in.
    const perVideoPending = new Map<string, number>()
    for (const r of rRows) {
      perVideoPending.set(
        r.video_id,
        (perVideoPending.get(r.video_id) ?? 0) + 1
      )
    }

    pendingReportItems = rRows.map((r) => ({
      reportId: r.id,
      videoId: r.video_id,
      videoTitle: videoTitles.get(r.video_id) ?? '(video not found)',
      reasonType: r.reason_type,
      note: r.note,
      reporterUsername: reporterMap.get(r.reporter_id)?.username ?? null,
      reporterWarningsSoFar: reporterMap.get(r.reporter_id)?.warnings ?? 0,
      reporterRevoked: reporterMap.get(r.reporter_id)?.revoked ?? false,
      createdAt: r.created_at,
      otherPendingCount: Math.max(
        0,
        (perVideoPending.get(r.video_id) ?? 1) - 1
      ),
    }))
  }

  // ------------------------------------------------------------------
  // Pending code submissions (admin-only). Uses the service client so
  // it can read pending rows regardless of RLS.
  // ------------------------------------------------------------------
  type PendingCipher = {
    id: string
    slug: string
    title: string
    summary: string
    cipher_text: string
    animation_slug: string | null
    submitter_id: string
    created_at: string
  }
  let pendingCiphers: PendingCipher[] = []
  const pendingCipherSubmitters = new Map<string, string>()
  if (userIsAdmin) {
    const service = createServiceClient()
    const { data: cRows } = await service
      .from('code_ciphers')
      .select('id, slug, title, summary, cipher_text, animation_slug, submitter_id, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .returns<PendingCipher[]>()
    pendingCiphers = cRows ?? []
    if (pendingCiphers.length > 0) {
      const ids = Array.from(new Set(pendingCiphers.map((c) => c.submitter_id)))
      const { data: uRows } = await service
        .from('users')
        .select('id, username')
        .in('id', ids)
      for (const u of uRows ?? []) {
        pendingCipherSubmitters.set(
          (u as { id: string }).id,
          (u as { username: string }).username
        )
      }
    }
  }

  return (
    <>
      <DiscussHeader />
      <main className="flex-1 px-4 sm:px-6 py-8 sm:py-12">
        <div className="mx-auto max-w-2xl space-y-14">
          {/* ----------------------------------------------------------------
              Code submissions (admin-only)
          ---------------------------------------------------------------- */}
          {userIsAdmin && (
            <section>
              <h2 className="text-xl font-semibold">Code submissions</h2>
              <p className="mt-1 text-sm text-stone-600">
                Broken codes people have submitted. Approving publishes to
                /code and (optionally) links the animation folder under
                public/code-assets/.
              </p>

              {pendingCiphers.length === 0 ? (
                <p className="mt-4 text-sm text-stone-500">
                  Nothing pending.
                </p>
              ) : (
                <ul className="mt-4 divide-y divide-stone-200 border-y border-stone-200">
                  {pendingCiphers.map((c) => {
                    const submitter =
                      pendingCipherSubmitters.get(c.submitter_id) ?? 'unknown'
                    return (
                      <li key={c.id} className="py-4">
                        <p className="text-sm font-medium text-stone-800">
                          {c.title}
                        </p>
                        <p className="mt-0.5 text-xs text-stone-500">
                          {c.summary}
                        </p>
                        <pre className="mt-2 whitespace-pre-wrap break-words rounded bg-stone-50 border border-stone-200 p-2 text-xs text-stone-700 font-mono">
                          {c.cipher_text}
                        </pre>
                        <p className="mt-1 text-xs text-stone-400">
                          by {submitter} · {formatWhen(c.created_at)} · slug{' '}
                          <code>{c.slug}</code>
                        </p>

                        <form
                          action={approveCipherAction}
                          className="mt-3 flex flex-wrap items-end gap-2"
                        >
                          <input type="hidden" name="cipher_id" value={c.id} />
                          <label className="flex flex-col gap-1 text-xs">
                            <span className="text-stone-500">
                              Animation slug{' '}
                              <span className="text-stone-400">
                                (folder under /public/code-assets, optional)
                              </span>
                            </span>
                            <input
                              type="text"
                              name="animation_slug"
                              defaultValue={c.animation_slug ?? ''}
                              placeholder="shugborough"
                              pattern="[a-z0-9]+(-[a-z0-9]+)*"
                              className="w-64 rounded border border-stone-300 px-2 py-1 text-sm"
                            />
                          </label>
                          <button
                            type="submit"
                            className="rounded bg-stone-900 text-stone-50 px-3 py-1.5 text-xs hover:bg-stone-700"
                          >
                            Approve &amp; publish
                          </button>
                        </form>

                        <form action={rejectCipherAction} className="mt-2">
                          <input type="hidden" name="cipher_id" value={c.id} />
                          <button
                            type="submit"
                            className="text-xs text-stone-500 underline hover:text-red-700"
                            onClick={(e) => {
                              if (!confirm('Reject this submission?'))
                                e.preventDefault()
                            }}
                          >
                            Reject
                          </button>
                        </form>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          )}

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
                        {getDisplayUsername(r.author_id, r.users?.username ?? 'unknown', adminIds)}
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

                    <p className="mt-2 whitespace-pre-wrap break-words text-sm text-stone-800">
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
                        {getDisplayUsername(r.submitter_id, r.users?.username ?? 'unknown', adminIds)}
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
                      submitted by {getDisplayUsername(r.submitter_id, r.users?.username ?? 'unknown', adminIds)}
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

          {/* ----------------------------------------------------------------
              Section 4: Video reports (admin only)
          ---------------------------------------------------------------- */}
          {userIsAdmin && (
            <section>
              <h2 className="text-xl font-semibold">Video reports</h2>
              <p className="mt-2 text-sm text-stone-600">
                Videos that have been reported by a viewer. Each report is
                already holding the video off the feed until you decide.
              </p>

              {pendingReportItems.length === 0 ? (
                <p className="mt-6 text-sm text-stone-500">
                  No pending reports.
                </p>
              ) : (
                <ul className="mt-4 divide-y divide-stone-200 border-y border-stone-200">
                  {pendingReportItems.map((r) => (
                    <VideoReportReviewItem key={r.reportId} {...r} />
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* ----------------------------------------------------------------
              Section 5: Video taxonomy queue (admin only)
          ---------------------------------------------------------------- */}
          {userIsAdmin && (
            <section>
              <h2 className="text-xl font-semibold">Video categories awaiting review</h2>
              <p className="mt-2 text-sm text-stone-600">
                Categories a user picked &quot;other&quot; for. Live already; you can
                keep them, rename to something cleaner, merge into an existing
                one, or reject the whole thing (unpublishes any videos filed
                under it).
              </p>

              {pendingCategoryItems.length === 0 ? (
                <p className="mt-6 text-sm text-stone-500">
                  No categories awaiting review.
                </p>
              ) : (
                <ul className="mt-4 divide-y divide-stone-200 border-y border-stone-200">
                  {pendingCategoryItems.map((c) => (
                    <VideoTaxonomyReviewItem
                      key={c.id}
                      kind="category"
                      {...c}
                    />
                  ))}
                </ul>
              )}

              <h3 className="mt-8 text-base font-semibold">
                Subcategories awaiting review
              </h3>
              <p className="mt-1 text-sm text-stone-600">
                Same choices as above. Reject only clears the subcategory tag
                on the videos; it does not unpublish them.
              </p>

              {pendingSubcategoryItems.length === 0 ? (
                <p className="mt-4 text-sm text-stone-500">
                  No subcategories awaiting review.
                </p>
              ) : (
                <ul className="mt-4 divide-y divide-stone-200 border-y border-stone-200">
                  {pendingSubcategoryItems.map((s) => (
                    <VideoTaxonomyReviewItem
                      key={s.id}
                      kind="subcategory"
                      {...s}
                    />
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
