import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import MeetupsHeader from '@/components/MeetupsHeader'
import SiteFooter from '@/components/SiteFooter'
import { createClient } from '@/lib/supabase/server'
import {
  editMeetupAction,
  cancelMeetupAction,
  postOrganizerAnnouncementAction,
  postDirectedMessageAction,
  addNeedAction,
  arrangeNeedAction,
  deleteNeedAction,
} from '../../actions'

function formatMeetupDateLocal(iso: string): string {
  // Returns a datetime-local compatible string (YYYY-MM-DDTHH:mm).
  const d = new Date(iso)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const statusLabel: Record<string, string> = {
  needed: 'Needed',
  offered: 'Offered',
  arranged: 'Arranged',
}

export default async function ManageMeetupPage(
  props: PageProps<'/meetups/[meetupId]/manage'>
) {
  const { meetupId } = await props.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/signin?next=/meetups/${meetupId}/manage`)

  // Fetch meetup — must be organiser.
  const { data: meetup } = await supabase
    .from('meetups')
    .select(
      'id, title, description, date_time, location, is_online, status, organiser_id, max_attendees, meetup_questions(id, question_text, display_order)'
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
      meetup_questions: { id: string; question_text: string; display_order: number }[]
    }>()

  if (!meetup) notFound()
  if (meetup.organiser_id !== user.id) {
    redirect(`/meetups/${meetupId}`)
  }

  const questions = (meetup.meetup_questions ?? []).sort(
    (a, b) => a.display_order - b.display_order
  )
  const isCancelled = meetup.status === 'cancelled'

  // Fetch registrations with answers.
  const { data: regs } = await supabase
    .from('meetup_registrations')
    .select(
      'id, user_id, is_waitlist, created_at, users:user_id(username), meetup_answers(question_id, answer_text)'
    )
    .eq('meetup_id', meetupId)
    .order('created_at', { ascending: true })
    .returns<{
      id: string
      user_id: string
      is_waitlist: boolean
      created_at: string
      users: { username: string } | null
      meetup_answers: { question_id: string; answer_text: string }[]
    }[]>()

  const allRegs = regs ?? []
  const confirmed = allRegs.filter((r) => !r.is_waitlist)
  const waitlist = allRegs.filter((r) => r.is_waitlist)

  // Fetch needs.
  const { data: needsData } = await supabase
    .from('meetup_needs')
    .select('id, description, estimated_cost, status, offered_by, users_offered:offered_by(username)')
    .eq('meetup_id', meetupId)
    .order('created_at', { ascending: true })
    .returns<{
      id: string
      description: string
      estimated_cost: string | null
      status: string
      offered_by: string | null
      users_offered: { username: string } | null
    }[]>()

  const needs = needsData ?? []

  return (
    <>
      <MeetupsHeader />
      <main className="flex-1 px-6 py-12">
        <div className="mx-auto max-w-2xl space-y-14">
          <div>
            <p className="text-sm text-stone-500">
              <Link
                href={`/meetups/${meetupId}`}
                className="underline hover:text-stone-900"
              >
                ← {meetup.title}
              </Link>
            </p>
            <h1 className="mt-1 text-2xl font-semibold">Manage meetup</h1>
            {isCancelled && (
              <div className="mt-3 rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
                This meetup has been cancelled.
              </div>
            )}
          </div>

          {/* ---- Attendees ---- */}
          <section>
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-semibold">
                Attendees{' '}
                <span className="text-base font-normal text-stone-500">
                  ({confirmed.length} confirmed
                  {waitlist.length > 0 && `, ${waitlist.length} waitlist`})
                </span>
              </h2>
              <a
                href={`/meetups/${meetupId}/manage/export`}
                className="text-sm text-stone-600 underline hover:text-stone-900"
              >
                Export CSV
              </a>
            </div>

            {confirmed.length === 0 ? (
              <p className="mt-4 text-sm text-stone-500">No one registered yet.</p>
            ) : (
              <ul className="mt-4 divide-y divide-stone-200 border-y border-stone-200">
                {confirmed.map((reg) => {
                  const username = reg.users?.username ?? 'unknown'
                  const answerMap = new Map(
                    (reg.meetup_answers ?? []).map((a) => [a.question_id, a.answer_text])
                  )
                  return (
                    <li key={reg.id} className="py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-stone-800">{username}</p>
                          <p className="text-xs text-stone-400">
                            Registered{' '}
                            {new Date(reg.created_at).toLocaleString('en-GB', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </p>
                          {questions.map((q) => {
                            const answer = answerMap.get(q.id)
                            if (!answer) return null
                            return (
                              <div key={q.id} className="mt-2">
                                <p className="text-xs text-stone-500">{q.question_text}</p>
                                <p className="text-sm text-stone-700">{answer}</p>
                              </div>
                            )
                          })}
                        </div>
                        {/* Contact individual */}
                        {!isCancelled && (
                          <details className="shrink-0">
                            <summary className="cursor-pointer text-xs text-stone-500 underline hover:text-stone-800 list-none [&::-webkit-details-marker]:hidden">
                              Contact
                            </summary>
                            <form
                              action={postDirectedMessageAction}
                              className="mt-2 flex flex-col gap-2 w-64"
                            >
                              <input type="hidden" name="meetup_id" value={meetupId} />
                              <input type="hidden" name="target_username" value={username} />
                              <textarea
                                name="content"
                                required
                                rows={3}
                                placeholder={`Message to @${username}…`}
                                className="rounded border border-stone-300 px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
                              />
                              <button
                                type="submit"
                                className="rounded bg-stone-900 text-stone-50 px-3 py-1.5 text-sm hover:bg-stone-700"
                              >
                                Post in discussion
                              </button>
                            </form>
                          </details>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}

            {waitlist.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-stone-600">Waitlist</h3>
                <ul className="mt-2 divide-y divide-stone-200 border-y border-stone-200">
                  {waitlist.map((reg) => (
                    <li key={reg.id} className="py-3 text-sm text-stone-600">
                      {reg.users?.username ?? 'unknown'}{' '}
                      <span className="text-xs text-stone-400">
                        · joined{' '}
                        {new Date(reg.created_at).toLocaleString('en-GB', {
                          dateStyle: 'medium',
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* ---- Post announcement ---- */}
          {!isCancelled && (
            <section>
              <h2 className="text-xl font-semibold">Post an announcement</h2>
              <p className="mt-1 text-sm text-stone-500">
                Posted publicly in the meetup discussion, pinned to the top.
              </p>
              <form
                action={postOrganizerAnnouncementAction}
                className="mt-4 flex flex-col gap-3"
              >
                <input type="hidden" name="meetup_id" value={meetupId} />
                <textarea
                  name="content"
                  required
                  rows={4}
                  placeholder="Announcement text…"
                  className="rounded border border-stone-300 px-3 py-2 text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
                />
                <div>
                  <button
                    type="submit"
                    className="rounded bg-stone-900 text-stone-50 px-4 py-2 text-sm hover:bg-stone-700"
                  >
                    Post announcement
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* ---- What's needed ---- */}
          <section>
            <h2 className="text-xl font-semibold">What&rsquo;s needed</h2>

            {needs.length === 0 ? (
              <p className="mt-4 text-sm text-stone-500">Nothing listed yet.</p>
            ) : (
              <ul className="mt-4 divide-y divide-stone-200 border-y border-stone-200">
                {needs.map((need) => (
                  <li key={need.id} className="py-4 flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-sm text-stone-800">{need.description}</p>
                      {need.estimated_cost && (
                        <p className="text-xs text-stone-500 mt-0.5">
                          Cost: {need.estimated_cost}
                        </p>
                      )}
                      <div className="mt-1 flex items-center gap-2">
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-medium ${
                            need.status === 'arranged'
                              ? 'bg-green-100 text-green-800'
                              : need.status === 'offered'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-stone-100 text-stone-600'
                          }`}
                        >
                          {statusLabel[need.status] ?? need.status}
                        </span>
                        {need.users_offered && (
                          <span className="text-xs text-stone-500">
                            by {need.users_offered.username}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 items-end shrink-0">
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
                  </li>
                ))}
              </ul>
            )}

            {!isCancelled && (
              <form action={addNeedAction} className="mt-4 flex gap-3">
                <input type="hidden" name="meetup_id" value={meetupId} />
                <input
                  name="description"
                  type="text"
                  required
                  maxLength={500}
                  placeholder="Add a need…"
                  className="flex-1 rounded border border-stone-300 px-3 py-2 text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
                />
                <input
                  name="estimated_cost"
                  type="text"
                  maxLength={200}
                  placeholder="Est. cost"
                  className="w-36 rounded border border-stone-300 px-3 py-2 text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
                />
                <button
                  type="submit"
                  className="rounded bg-stone-900 text-stone-50 px-3 py-2 text-sm hover:bg-stone-700"
                >
                  Add
                </button>
              </form>
            )}
          </section>

          {/* ---- Edit details ---- */}
          {!isCancelled && (
            <section>
              <h2 className="text-xl font-semibold">Edit details</h2>
              <form action={editMeetupAction} className="mt-4 flex flex-col gap-5">
                <input type="hidden" name="meetup_id" value={meetupId} />

                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-stone-700 font-medium">Title</span>
                  <input
                    name="title"
                    type="text"
                    required
                    maxLength={200}
                    defaultValue={meetup.title}
                    className="rounded border border-stone-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
                  />
                </label>

                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-stone-700 font-medium">Description</span>
                  <textarea
                    name="description"
                    required
                    maxLength={5000}
                    rows={4}
                    defaultValue={meetup.description}
                    className="rounded border border-stone-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
                  />
                </label>

                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-stone-700 font-medium">Date and time</span>
                  <input
                    name="date_time"
                    type="datetime-local"
                    required
                    defaultValue={formatMeetupDateLocal(meetup.date_time)}
                    className="rounded border border-stone-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-stone-400 w-fit"
                  />
                </label>

                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-stone-700 font-medium">Location</span>
                  <input
                    name="location"
                    type="text"
                    required
                    maxLength={200}
                    defaultValue={meetup.location}
                    className="rounded border border-stone-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
                  />
                </label>

                <div className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    name="is_online_check"
                    id="is_online_check"
                    defaultChecked={meetup.is_online}
                    onChange={(e) => {
                      const hiddenInput = e.currentTarget.form?.querySelector(
                        'input[name="is_online"]'
                      ) as HTMLInputElement | null
                      if (hiddenInput) hiddenInput.value = e.currentTarget.checked ? 'true' : 'false'
                    }}
                    className="h-4 w-4"
                  />
                  <input
                    type="hidden"
                    name="is_online"
                    defaultValue={meetup.is_online ? 'true' : 'false'}
                  />
                  <label htmlFor="is_online_check" className="text-stone-700">
                    Online event
                  </label>
                </div>

                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-stone-700 font-medium">
                    Maximum attendees{' '}
                    <span className="font-normal text-stone-400">(leave blank for unlimited)</span>
                  </span>
                  <input
                    name="max_attendees"
                    type="number"
                    min={1}
                    max={10000}
                    defaultValue={meetup.max_attendees ?? ''}
                    className="rounded border border-stone-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-stone-400 w-32"
                  />
                </label>

                <div>
                  <button
                    type="submit"
                    className="rounded bg-stone-900 text-stone-50 px-5 py-2 text-sm hover:bg-stone-700"
                  >
                    Save changes
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* ---- Cancel meetup ---- */}
          {!isCancelled && (
            <section>
              <h2 className="text-xl font-semibold text-red-800">Cancel meetup</h2>
              <p className="mt-1 text-sm text-stone-500">
                Marks the meetup as cancelled and posts a pinned announcement in the
                discussion. This cannot be undone.
              </p>
              <form action={cancelMeetupAction} className="mt-4">
                <input type="hidden" name="meetup_id" value={meetupId} />
                <button
                  type="submit"
                  className="rounded border border-red-300 px-4 py-2 text-sm text-red-700 hover:border-red-500 hover:text-red-900"
                  onClick={(e) => {
                    if (
                      !confirm(
                        'Cancel this meetup? A pinned announcement will be posted in the discussion and this cannot be undone.'
                      )
                    )
                      e.preventDefault()
                  }}
                >
                  Cancel this meetup
                </button>
              </form>
            </section>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
