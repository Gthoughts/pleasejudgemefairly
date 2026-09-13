import Link from 'next/link'
import { redirect } from 'next/navigation'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'
import { createClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'Help Out — a place for you',
}

type HelpOutRow = {
  id: string
  title: string
  description: string
  area: string
  photo_urls: string[] | null
  status: string
  created_at: string
  requester_id: string
  users: { username: string } | null
  help_out_dates: { id: string }[]
  help_out_volunteers: { count: number }[]
}

export default async function HelpOutsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/signin?next=/helpouts')

  const { data } = await supabase
    .from('help_outs')
    .select(
      'id, title, description, area, photo_urls, status, created_at, requester_id, users:requester_id(username), help_out_dates(id), help_out_volunteers(count)'
    )
    .order('created_at', { ascending: false })
    .returns<HelpOutRow[]>()

  const rows = data ?? []

  function statusBadge(status: string) {
    if (status === 'sorted')
      return (
        <span className="inline-block rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">
          Sorted
        </span>
      )
    if (status === 'cancelled')
      return (
        <span className="inline-block rounded bg-stone-100 px-2 py-0.5 text-xs text-stone-500">
          Closed
        </span>
      )
    return (
      <span className="inline-block rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
        Open
      </span>
    )
  }

  return (
    <>
      <SiteHeader />
      <main className="flex-1 px-4 sm:px-6 py-8 sm:py-12">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl font-semibold">Help Out</h1>
            <Link
              href="/helpouts/new"
              className="shrink-0 rounded bg-stone-900 text-stone-50 px-4 py-2 text-sm hover:bg-stone-700"
            >
              Ask for help
            </Link>
          </div>
          <p className="mt-2 text-sm text-stone-600">
            Neighbours helping neighbours with practical things: a fallen fence,
            an overwhelming garage, a house move. Post what you need, offer some
            possible dates, and members can say when they can lend a hand.
          </p>

          {rows.length === 0 ? (
            <p className="mt-10 text-sm text-stone-500">
              Nothing here yet.{' '}
              <Link href="/helpouts/new" className="underline hover:text-stone-800">
                Be the first to ask.
              </Link>
            </p>
          ) : (
            <ul className="mt-8 divide-y divide-stone-200 border-y border-stone-200">
              {rows.map((h) => {
                const dateCount = h.help_out_dates?.length ?? 0
                const volCount = h.help_out_volunteers?.[0]?.count ?? 0
                const firstPhoto = h.photo_urls?.[0] ?? null
                const snippet =
                  h.description.length > 160
                    ? h.description.slice(0, 160).trimEnd() + '…'
                    : h.description
                return (
                  <li key={h.id} className="py-5">
                    <div className="flex items-start gap-4">
                      {firstPhoto && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={firstPhoto}
                          alt=""
                          className="h-16 w-16 shrink-0 rounded object-cover border border-stone-200"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/helpouts/${h.id}`}
                            className="text-base font-medium text-stone-800 hover:underline"
                          >
                            {h.title}
                          </Link>
                          {statusBadge(h.status)}
                        </div>
                        <p className="mt-1 text-sm text-stone-500">
                          {h.area}
                          <span className="mx-1">·</span>
                          {h.users?.username ?? 'unknown'}
                        </p>
                        <p className="mt-1 text-sm text-stone-600 break-words">{snippet}</p>
                        <p className="mt-1 text-xs text-stone-400">
                          {dateCount} possible {dateCount === 1 ? 'date' : 'dates'}
                          <span className="mx-1">·</span>
                          {volCount} {volCount === 1 ? 'offer' : 'offers'} to help
                        </p>
                      </div>
                    </div>
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
