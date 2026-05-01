import Link from 'next/link'
import { redirect } from 'next/navigation'
import MeetupsHeader from '@/components/MeetupsHeader'
import SiteFooter from '@/components/SiteFooter'
import { createClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'Meetups — pleasejudgemefairly',
}

function formatMeetupDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type MeetupRow = {
  id: string
  title: string
  date_time: string
  location: string
  is_online: boolean
  status: string
  organiser_id: string
  meetup_registrations: { count: number }[]
}

export default async function MeetupsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/signin?next=/meetups')

  const now = new Date().toISOString()

  const { data: upcoming } = await supabase
    .from('meetups')
    .select('id, title, date_time, location, is_online, status, organiser_id, meetup_registrations(count)')
    .gte('date_time', now)
    .order('date_time', { ascending: true })
    .returns<MeetupRow[]>()

  const { data: past } = await supabase
    .from('meetups')
    .select('id, title, date_time, location, is_online, status, organiser_id, meetup_registrations(count)')
    .lt('date_time', now)
    .order('date_time', { ascending: false })
    .limit(50)
    .returns<MeetupRow[]>()

  const upcomingRows = upcoming ?? []
  const pastRows = past ?? []

  function MeetupCard({ m }: { m: MeetupRow }) {
    const regCount = m.meetup_registrations?.[0]?.count ?? 0
    return (
      <li className="py-5">
        {m.status === 'cancelled' && (
          <span className="inline-block mb-1 rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">
            Cancelled
          </span>
        )}
        <Link
          href={`/meetups/${m.id}`}
          className="text-base font-medium text-stone-800 hover:underline"
        >
          {m.title}
        </Link>
        <p className="mt-1 text-sm text-stone-500">
          {formatMeetupDate(m.date_time)}
          <span className="mx-1">·</span>
          {m.location}
          {m.is_online && <span className="ml-1 text-stone-400">(online)</span>}
        </p>
        <p className="mt-0.5 text-xs text-stone-400">
          {regCount} {regCount === 1 ? 'person' : 'people'} registered
        </p>
      </li>
    )
  }

  return (
    <>
      <MeetupsHeader />
      <main className="flex-1 px-6 py-12">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">Meetups</h1>
            <Link
              href="/meetups/new"
              className="rounded bg-stone-900 text-stone-50 px-4 py-2 text-sm hover:bg-stone-700"
            >
              Organise a meetup
            </Link>
          </div>

          {upcomingRows.length === 0 ? (
            <p className="mt-10 text-sm text-stone-500">
              No upcoming meetups.{' '}
              <Link href="/meetups/new" className="underline hover:text-stone-800">
                Organise the first one.
              </Link>
            </p>
          ) : (
            <ul className="mt-8 divide-y divide-stone-200 border-y border-stone-200">
              {upcomingRows.map((m) => (
                <MeetupCard key={m.id} m={m} />
              ))}
            </ul>
          )}

          {pastRows.length > 0 && (
            <section className="mt-16">
              <h2 className="text-lg font-medium text-stone-700">Past meetups</h2>
              <ul className="mt-4 divide-y divide-stone-200 border-y border-stone-200">
                {pastRows.map((m) => (
                  <MeetupCard key={m.id} m={m} />
                ))}
              </ul>
            </section>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
