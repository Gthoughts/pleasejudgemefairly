import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'
import ConfirmSubmitButton from '@/components/ConfirmSubmitButton'
import { createClient } from '@/lib/supabase/server'
import VolunteerForm from './VolunteerForm'
import { markSortedAction, deleteHelpOutAction } from '../actions'

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

type HelpOutDate = { id: string; the_date: string; display_order: number }

type VolunteerRow = {
  id: string
  date_id: string
  user_id: string
  users: { username: string } | null
}

export default async function HelpOutPage(props: PageProps<'/helpouts/[helpOutId]'>) {
  const { helpOutId } = await props.params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/signin?next=/helpouts/${helpOutId}`)

  const { data: helpOut } = await supabase
    .from('help_outs')
    .select(
      'id, title, description, area, photo_urls, status, created_at, requester_id, users:requester_id(username)'
    )
    .eq('id', helpOutId)
    .maybeSingle<{
      id: string
      title: string
      description: string
      area: string
      photo_urls: string[] | null
      status: string
      created_at: string
      requester_id: string
      users: { username: string } | null
    }>()

  if (!helpOut) notFound()

  const [datesRes, volunteersRes] = await Promise.all([
    supabase
      .from('help_out_dates')
      .select('id, the_date, display_order')
      .eq('help_out_id', helpOutId)
      .order('display_order', { ascending: true })
      .returns<HelpOutDate[]>(),
    supabase
      .from('help_out_volunteers')
      .select('id, date_id, user_id, users:user_id(username)')
      .eq('help_out_id', helpOutId)
      .returns<VolunteerRow[]>(),
  ])

  const dates = datesRes.data ?? []
  const volunteers = volunteersRes.data ?? []

  // Group volunteer usernames by date_id.
  const byDate = new Map<string, string[]>()
  for (const v of volunteers) {
    const list = byDate.get(v.date_id) ?? []
    list.push(v.users?.username ?? 'unknown')
    byDate.set(v.date_id, list)
  }

  const myDateIds = volunteers
    .filter((v) => v.user_id === user.id)
    .map((v) => v.date_id)

  const isRequester = helpOut.requester_id === user.id
  const isOpen = helpOut.status === 'open'
  const isSorted = helpOut.status === 'sorted'
  const requesterUsername = helpOut.users?.username ?? 'unknown'
  const photos = helpOut.photo_urls ?? []

  return (
    <>
      <SiteHeader />
      <main className="flex-1 px-4 sm:px-6 py-8 sm:py-12">
        <div className="mx-auto max-w-2xl space-y-10">
          <section>
            <p className="text-sm text-stone-500">
              <Link href="/helpouts" className="underline hover:text-stone-900">
                ← Help Out
              </Link>
            </p>

            {isSorted && (
              <div className="mt-3 rounded border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">
                This request is sorted. Thank you to everyone who offered.
              </div>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold">{helpOut.title}</h1>
              {isOpen ? (
                <span className="inline-block rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                  Open
                </span>
              ) : isSorted ? (
                <span className="inline-block rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">
                  Sorted
                </span>
              ) : (
                <span className="inline-block rounded bg-stone-100 px-2 py-0.5 text-xs text-stone-500">
                  Closed
                </span>
              )}
            </div>

            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-stone-500">Area</dt>
              <dd className="text-stone-800">{helpOut.area}</dd>
              <dt className="text-stone-500">Posted by</dt>
              <dd className="text-stone-800">{requesterUsername}</dd>
            </dl>

            <p className="mt-5 text-sm text-stone-700 whitespace-pre-wrap break-words">
              {helpOut.description}
            </p>

            {photos.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-3">
                {photos.map((url) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={url}
                    src={url}
                    alt=""
                    className="h-40 w-40 rounded object-cover border border-stone-200"
                  />
                ))}
              </div>
            )}
          </section>

          {/* Who can help, and when */}
          <section>
            <h2 className="text-xl font-semibold">Who can help, and when</h2>
            {dates.length === 0 ? (
              <p className="mt-2 text-sm text-stone-500">No dates listed.</p>
            ) : (
              <ul className="mt-4 divide-y divide-stone-200 border-y border-stone-200">
                {dates.map((d) => {
                  const names = byDate.get(d.id) ?? []
                  return (
                    <li key={d.id} className="py-4">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-sm font-medium text-stone-800">
                          {formatDate(d.the_date)}
                        </span>
                        <span className="shrink-0 text-xs text-stone-500">
                          {names.length} {names.length === 1 ? 'helper' : 'helpers'}
                        </span>
                      </div>
                      {names.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {names.map((n, i) => (
                            <span
                              key={`${d.id}-${i}`}
                              className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-600"
                            >
                              {n}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1 text-xs text-stone-400">No one yet.</p>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {/* Volunteer controls (non-requester, open) */}
          {!isRequester && isOpen && dates.length > 0 && (
            <section>
              <VolunteerForm
                helpOutId={helpOutId}
                dates={dates.map((d) => ({ id: d.id, the_date: d.the_date }))}
                myDateIds={myDateIds}
              />
            </section>
          )}

          {!isRequester && !isOpen && (
            <p className="text-sm text-stone-500">
              This request is no longer taking offers.
            </p>
          )}

          {/* Requester controls */}
          {isRequester && (
            <section className="rounded border border-stone-200 bg-stone-50 p-4">
              <h2 className="text-sm font-medium text-stone-800">You posted this</h2>
              <p className="mt-1 text-xs text-stone-500">
                Share your exact address privately by messaging a helper, it is
                never shown here.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {isOpen && (
                  <form action={markSortedAction}>
                    <input type="hidden" name="help_out_id" value={helpOutId} />
                    <ConfirmSubmitButton
                      confirmMessage="Mark this as sorted? It will stop new offers."
                      className="rounded bg-stone-900 text-stone-50 px-4 py-2 text-sm hover:bg-stone-700"
                    >
                      Mark as sorted
                    </ConfirmSubmitButton>
                  </form>
                )}
                <form action={deleteHelpOutAction}>
                  <input type="hidden" name="help_out_id" value={helpOutId} />
                  <ConfirmSubmitButton
                    confirmMessage="Delete this request? This cannot be undone."
                    className="rounded border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:border-red-400 hover:text-red-700"
                  >
                    Delete
                  </ConfirmSubmitButton>
                </form>
              </div>
            </section>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
