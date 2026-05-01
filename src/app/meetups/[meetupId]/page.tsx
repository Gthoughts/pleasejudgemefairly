import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import MeetupsHeader from '@/components/MeetupsHeader'
import SiteFooter from '@/components/SiteFooter'
import { createClient } from '@/lib/supabase/server'
import { getAdminUserIds, getDisplayUsername } from '@/lib/admin'
import { MAX_REPLY_DEPTH } from '@/lib/discuss'
import RegistrationSection from './RegistrationSection'
import MeetupPostItem from './MeetupPostItem'
import MeetupRootReplyForm from './MeetupRootReplyForm'
import {
  addNeedAction,
  offerNeedAction,
  withdrawOfferAction,
  arrangeNeedAction,
  deleteNeedAction,
} from '../actions'

function formatMeetupDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type MeetupPostRow = {
  id: string
  meetup_id: string
  parent_post_id: string | null
  author_id: string
  content: string
  is_pinned: boolean
  is_collapsed: boolean
  hold_state: 'none' | 'held' | 'released'
  hold_reasons: string[] | null
  created_at: string
  updated_at: string
  users: { username: string } | null
}

type PostNode = MeetupPostRow & { depth: number; children: PostNode[] }

function buildTree(posts: MeetupPostRow[]): PostNode[] {
  const byId = new Map<string, PostNode>()
  for (const p of posts) {
    byId.set(p.id, { ...p, depth: 0, children: [] })
  }
  const roots: PostNode[] = []
  for (const node of byId.values()) {
    if (node.parent_post_id && byId.has(node.parent_post_id)) {
      const parent = byId.get(node.parent_post_id)!
      node.depth = parent.depth + 1
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }
  const sort = (nodes: PostNode[]) => {
    nodes.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    nodes.forEach((n) => sort(n.children))
  }
  sort(roots)
  // Pinned posts always appear first among roots.
  roots.sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0))
  return roots
}

function renderNode(
  node: PostNode,
  common: {
    meetupId: string
    currentUserId: string | null
    mutedIds: Set<string>
    myRatings: Map<string, 'helpful' | 'unhelpful'>
    adminIds: Set<string>
  }
): React.ReactNode {
  return (
    <MeetupPostItem
      key={node.id}
      post={{
        id: node.id,
        content: node.content,
        created_at: node.created_at,
        updated_at: node.updated_at,
        author_id: node.author_id,
        author_username: getDisplayUsername(
          node.author_id,
          node.users?.username ?? 'unknown',
          common.adminIds
        ),
        depth: node.depth,
        isPinned: node.is_pinned,
        isCollapsed: node.is_collapsed,
        holdState: node.hold_state,
        holdReasons: node.hold_reasons,
      }}
      meetupId={common.meetupId}
      currentUserId={common.currentUserId}
      isMutedByMe={common.mutedIds.has(node.author_id)}
      myRating={common.myRatings.get(node.id) ?? null}
      canReply={!!common.currentUserId && node.depth < MAX_REPLY_DEPTH}
    >
      {node.children.length > 0 && (
        <ul className="mt-4 space-y-4 border-l border-stone-200 pl-4">
          {node.children.map((child) => (
            <li key={child.id}>{renderNode(child, common)}</li>
          ))}
        </ul>
      )}
    </MeetupPostItem>
  )
}

const statusLabel: Record<string, string> = {
  needed: 'Needed',
  offered: 'Offered',
  arranged: 'Arranged',
}

export default async function MeetupPage(props: PageProps<'/meetups/[meetupId]'>) {
  const { meetupId } = await props.params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/signin?next=/meetups/${meetupId}`)

  const adminIds = await getAdminUserIds()

  // Fetch meetup + questions.
  const { data: meetup } = await supabase
    .from('meetups')
    .select(
      'id, title, description, date_time, location, is_online, status, organiser_id, max_attendees, users:organiser_id(username), meetup_questions(id, question_text, display_order)'
    )
    .eq('id', meetupId)
    .maybeSingle<{
      id: string
      title: string
      description: string
      date_time: string
      location: string
      is_online: boolean
      status: string
      organiser_id: string
      max_attendees: number | null
      users: { username: string } | null
      meetup_questions: { id: string; question_text: string; display_order: number }[]
    }>()

  if (!meetup) notFound()

  const questions = (meetup.meetup_questions ?? []).sort(
    (a, b) => a.display_order - b.display_order
  )

  // Fetch registrations (non-waitlist for count/list; all for current user check).
  const { data: registrations } = await supabase
    .from('meetup_registrations')
    .select('id, user_id, is_waitlist, users:user_id(username)')
    .eq('meetup_id', meetupId)
    .returns<{ id: string; user_id: string; is_waitlist: boolean; users: { username: string } | null }[]>()

  const allRegs = registrations ?? []
  const confirmed = allRegs.filter((r) => !r.is_waitlist)
  const attendeeCount = confirmed.length
  const attendees = confirmed.map((r) => r.users?.username ?? 'unknown')
  const myReg = allRegs.find((r) => r.user_id === user.id)
  const isRegistered = !!myReg
  const isWaitlisted = myReg?.is_waitlist === true
  const isFull =
    meetup.max_attendees !== null && attendeeCount >= meetup.max_attendees && !isRegistered
  const isCancelled = meetup.status === 'cancelled'
  const isOrganiser = meetup.organiser_id === user.id

  // Fetch needs.
  const { data: needsData } = await supabase
    .from('meetup_needs')
    .select('id, description, estimated_cost, status, offered_by, added_by, users_offered:offered_by(username), users_added:added_by(username)')
    .eq('meetup_id', meetupId)
    .order('created_at', { ascending: true })
    .returns<{
      id: string
      description: string
      estimated_cost: string | null
      status: string
      offered_by: string | null
      added_by: string
      users_offered: { username: string } | null
      users_added: { username: string } | null
    }[]>()

  const needs = needsData ?? []
  const canAddNeeds = isOrganiser || (isRegistered && !isWaitlisted)

  // Fetch discussion posts.
  const { data: postRows } = await supabase
    .from('meetup_posts')
    .select(
      'id, meetup_id, parent_post_id, author_id, content, is_pinned, is_collapsed, hold_state, hold_reasons, created_at, updated_at, users:author_id(username)'
    )
    .eq('meetup_id', meetupId)
    .order('created_at', { ascending: true })
    .returns<MeetupPostRow[]>()

  const roots = buildTree(postRows ?? [])

  // Fetch mutes and ratings for current user.
  const mutedIds = new Set<string>()
  const myRatings = new Map<string, 'helpful' | 'unhelpful'>()

  const { data: mutes } = await supabase
    .from('mutes')
    .select('muted_user_id')
    .eq('user_id', user.id)
  for (const m of mutes ?? []) mutedIds.add((m as { muted_user_id: string }).muted_user_id)

  const postIds = (postRows ?? []).map((p) => p.id)
  if (postIds.length > 0) {
    const { data: ratingRows } = await supabase
      .from('ratings')
      .select('content_id, rating')
      .eq('user_id', user.id)
      .eq('content_type', 'meetup_post')
      .in('content_id', postIds)
    for (const r of ratingRows ?? []) {
      myRatings.set(
        r.content_id as string,
        r.rating as 'helpful' | 'unhelpful'
      )
    }
  }

  const common = { meetupId, currentUserId: user.id, mutedIds, myRatings, adminIds }
  const organiserUsername = getDisplayUsername(
    meetup.organiser_id,
    meetup.users?.username ?? 'unknown',
    adminIds
  )

  return (
    <>
      <MeetupsHeader />
      <main className="flex-1 px-6 py-12">
        <div className="mx-auto max-w-2xl space-y-14">

          {/* ---- Section 1: Details ---- */}
          <section>
            <p className="text-sm text-stone-500">
              <Link href="/meetups" className="underline hover:text-stone-900">
                ← Meetups
              </Link>
            </p>

            {isCancelled && (
              <div className="mt-3 rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
                This meetup has been cancelled.
              </div>
            )}

            <div className="mt-2 flex items-start justify-between gap-4">
              <h1 className="text-2xl font-semibold">{meetup.title}</h1>
              {isOrganiser && (
                <Link
                  href={`/meetups/${meetupId}/manage`}
                  className="shrink-0 rounded border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:border-stone-500 hover:text-stone-900"
                >
                  Manage
                </Link>
              )}
            </div>

            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-stone-500">When</dt>
              <dd className="text-stone-800">{formatMeetupDate(meetup.date_time)}</dd>
              <dt className="text-stone-500">Where</dt>
              <dd className="text-stone-800">
                {meetup.location}
                {meetup.is_online && (
                  <span className="ml-2 rounded bg-stone-100 px-2 py-0.5 text-xs text-stone-500">
                    Online
                  </span>
                )}
              </dd>
              <dt className="text-stone-500">Organiser</dt>
              <dd className="text-stone-800">{organiserUsername}</dd>
            </dl>

            <p className="mt-5 text-sm text-stone-700 whitespace-pre-wrap">{meetup.description}</p>

            <div className="mt-8">
              <RegistrationSection
                meetupId={meetupId}
                questions={questions}
                isRegistered={isRegistered}
                isWaitlisted={isWaitlisted}
                isFull={isFull}
                isCancelled={isCancelled}
                attendeeCount={attendeeCount}
                maxAttendees={meetup.max_attendees}
                attendees={attendees}
              />
            </div>
          </section>

          {/* ---- Section 2: What's needed ---- */}
          <section>
            <h2 className="text-xl font-semibold">What&rsquo;s needed</h2>
            <p className="mt-1 text-sm text-stone-500">
              Things the meetup needs. Anyone registered can offer to help.
            </p>

            {needs.length === 0 && !canAddNeeds ? (
              <p className="mt-4 text-sm text-stone-500">Nothing listed yet.</p>
            ) : (
              <ul className="mt-4 divide-y divide-stone-200 border-y border-stone-200">
                {needs.map((need) => {
                  const offeredByMe = need.offered_by === user.id
                  const offererUsername = need.users_offered?.username ?? null
                  return (
                    <li key={need.id} className="py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-stone-800">{need.description}</p>
                          {need.estimated_cost && (
                            <p className="mt-0.5 text-xs text-stone-500">
                              Estimated cost: {need.estimated_cost}
                            </p>
                          )}
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                                need.status === 'arranged'
                                  ? 'bg-green-100 text-green-800'
                                  : need.status === 'offered'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-stone-100 text-stone-600'
                              }`}
                            >
                              {statusLabel[need.status] ?? need.status}
                            </span>
                            {offererUsername && (
                              <span className="text-xs text-stone-500">
                                by {getDisplayUsername(need.offered_by!, offererUsername, adminIds)}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-col gap-1 text-right">
                          {/* I'll sort this — shown when status is 'needed' and user hasn't offered */}
                          {need.status === 'needed' && !isOrganiser && (
                            <form action={offerNeedAction}>
                              <input type="hidden" name="need_id" value={need.id} />
                              <input type="hidden" name="meetup_id" value={meetupId} />
                              <button
                                type="submit"
                                className="text-xs text-stone-600 underline hover:text-stone-900"
                              >
                                I&rsquo;ll sort this
                              </button>
                            </form>
                          )}
                          {/* Withdraw offer — shown to the user who offered */}
                          {need.status === 'offered' && offeredByMe && !isOrganiser && (
                            <form action={withdrawOfferAction}>
                              <input type="hidden" name="need_id" value={need.id} />
                              <input type="hidden" name="meetup_id" value={meetupId} />
                              <button
                                type="submit"
                                className="text-xs text-stone-500 underline hover:text-stone-800"
                              >
                                Withdraw offer
                              </button>
                            </form>
                          )}
                          {/* Organiser controls */}
                          {isOrganiser && (
                            <div className="flex flex-col gap-1 items-end">
                              {need.status === 'offered' && (
                                <form action={arrangeNeedAction}>
                                  <input type="hidden" name="need_id" value={need.id} />
                                  <input type="hidden" name="meetup_id" value={meetupId} />
                                  <button
                                    type="submit"
                                    className="text-xs text-green-700 underline hover:text-green-900"
                                  >
                                    Mark arranged
                                  </button>
                                </form>
                              )}
                              {need.status === 'needed' && (
                                <form action={offerNeedAction}>
                                  <input type="hidden" name="need_id" value={need.id} />
                                  <input type="hidden" name="meetup_id" value={meetupId} />
                                  <button
                                    type="submit"
                                    className="text-xs text-stone-600 underline hover:text-stone-900"
                                  >
                                    I&rsquo;ll sort this
                                  </button>
                                </form>
                              )}
                              <form action={deleteNeedAction}>
                                <input type="hidden" name="need_id" value={need.id} />
                                <input type="hidden" name="meetup_id" value={meetupId} />
                                <button
                                  type="submit"
                                  className="text-xs text-stone-400 underline hover:text-red-700"
                                  onClick={(e) => {
                                    if (!confirm('Remove this item?')) e.preventDefault()
                                  }}
                                >
                                  Remove
                                </button>
                              </form>
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}

            {/* Add a need */}
            {canAddNeeds && !isCancelled && (
              <form action={addNeedAction} className="mt-4 flex flex-col gap-3">
                <input type="hidden" name="meetup_id" value={meetupId} />
                <div className="flex gap-3">
                  <input
                    name="description"
                    type="text"
                    required
                    maxLength={500}
                    placeholder="e.g. Venue for 20 people"
                    className="flex-1 rounded border border-stone-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
                  />
                  <input
                    name="estimated_cost"
                    type="text"
                    maxLength={200}
                    placeholder="Est. cost (optional)"
                    className="w-40 rounded border border-stone-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
                  />
                  <button
                    type="submit"
                    className="rounded bg-stone-900 text-stone-50 px-3 py-2 text-sm hover:bg-stone-700"
                  >
                    Add
                  </button>
                </div>
              </form>
            )}
          </section>

          {/* ---- Section 3: Discussion ---- */}
          <section>
            <h2 className="text-xl font-semibold">Discussion</h2>
            <p className="mt-1 text-sm text-stone-500">
              All coordination happens here, in the open.
            </p>

            {roots.length === 0 && (
              <p className="mt-6 text-sm text-stone-500">No messages yet.</p>
            )}

            <ul className="mt-6 space-y-6">
              {roots.map((node) => (
                <li key={node.id}>{renderNode(node, common)}</li>
              ))}
            </ul>

            {!isCancelled && (
              <div className="mt-10 border-t border-stone-200 pt-6">
                <h3 className="text-sm font-medium text-stone-700">Add a message</h3>
                <MeetupRootReplyForm meetupId={meetupId} />
              </div>
            )}
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
