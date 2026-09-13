import Link from 'next/link'
import { redirect } from 'next/navigation'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'
import { createClient } from '@/lib/supabase/server'
import DayAddButton from './DayAddButton'

export const metadata = {
  title: 'Calendar — a place for you',
}

type MeetupRow = {
  id: string
  title: string
  date_time: string
  status: string
  is_online: boolean
  location: string
}

type HelpOutDateRow = {
  the_date: string
  help_out_id: string
  help_outs: {
    id: string
    title: string
    area: string
    status: string
  } | null
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

// Zero-padded YYYY-MM-DD for a given year/month(1-based)/day.
function ymd(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${year}-${mm}-${dd}`
}

// Derive the UK-local calendar day (YYYY-MM-DD) for a timestamptz value.
function localDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', {
    timeZone: 'Europe/London',
  })
}

export default async function CalendarPage(props: PageProps<'/calendar'>) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/signin?next=/calendar')

  const sp = await props.searchParams

  // Work out which month to show. Default to the current UK month.
  const now = new Date()
  let year = now.getFullYear()
  let month = now.getMonth() + 1 // 1-based

  const mParam = typeof sp.m === 'string' ? sp.m : null
  if (mParam && /^\d{4}-\d{2}$/.test(mParam)) {
    const [y, mo] = mParam.split('-').map((n) => parseInt(n, 10))
    if (y >= 1970 && y <= 3000 && mo >= 1 && mo <= 12) {
      year = y
      month = mo
    }
  }

  // Range for the visible month: [firstOfMonth, firstOfNextMonth).
  const firstOfMonth = ymd(year, month, 1)
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  const firstOfNextMonth = ymd(nextYear, nextMonth, 1)

  // Query as ISO instants covering the whole month in UK time.
  const rangeStart = `${firstOfMonth}T00:00:00`
  const rangeEnd = `${firstOfNextMonth}T00:00:00`

  const [{ data: meetupData }, { data: helpDateData }] = await Promise.all([
    supabase
      .from('meetups')
      .select('id, title, date_time, status, is_online, location')
      .eq('status', 'active')
      .gte('date_time', rangeStart)
      .lt('date_time', rangeEnd)
      .order('date_time', { ascending: true })
      .returns<MeetupRow[]>(),
    supabase
      .from('help_out_dates')
      .select('the_date, help_out_id, help_outs(id, title, area, status)')
      .gte('the_date', firstOfMonth)
      .lt('the_date', firstOfNextMonth)
      .order('the_date', { ascending: true })
      .returns<HelpOutDateRow[]>(),
  ])

  const meetups = meetupData ?? []
  const helpDates = helpDateData ?? []

  // Bucket meetups by their UK-local calendar day.
  const meetupsByDay = new Map<string, MeetupRow[]>()
  for (const m of meetups) {
    const key = localDay(m.date_time)
    const list = meetupsByDay.get(key) ?? []
    list.push(m)
    meetupsByDay.set(key, list)
  }

  // Bucket help-outs by the_date, excluding cancelled ones.
  const helpsByDay = new Map<string, HelpOutDateRow[]>()
  for (const h of helpDates) {
    const ho = h.help_outs
    if (!ho) continue
    if (ho.status !== 'open' && ho.status !== 'sorted') continue
    const key = h.the_date
    const list = helpsByDay.get(key) ?? []
    list.push(h)
    helpsByDay.set(key, list)
  }

  // Grid geometry. Week starts Monday.
  const daysInMonth = new Date(year, month, 0).getDate()
  // JS getDay(): 0=Sun..6=Sat. Convert to Monday=0..Sunday=6.
  const firstWeekday = new Date(year, month - 1, 1).getDay()
  const offset = (firstWeekday + 6) % 7

  // Build cells: leading blanks + day numbers.
  const cells: (number | null)[] = []
  for (let i = 0; i < offset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const weeks: (number | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7))
  }

  // Prev / next month strings for navigation links.
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const prevM = `${prevYear}-${String(prevMonth).padStart(2, '0')}`
  const nextM = `${nextYear}-${String(nextMonth).padStart(2, '0')}`

  const todayKey = now.toLocaleDateString('en-CA', { timeZone: 'Europe/London' })
  const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <>
      <SiteHeader />
      <main className="flex-1 px-4 sm:px-6 py-8 sm:py-12">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl font-semibold">Calendar</h1>
            <div className="flex items-center gap-2">
              <Link
                href={`/calendar?m=${prevM}`}
                aria-label="Previous month"
                className="rounded border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-100"
              >
                ← Prev
              </Link>
              <Link
                href={`/calendar?m=${nextM}`}
                aria-label="Next month"
                className="rounded border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-100"
              >
                Next →
              </Link>
            </div>
          </div>

          <p className="mt-2 text-lg font-medium text-stone-700">
            {MONTH_NAMES[month - 1]} {year}
          </p>

          {/* Legend */}
          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-stone-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />
              Meetup
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
              Help Out
            </span>
          </div>

          {/* Weekday header */}
          <div className="mt-6 grid grid-cols-7 gap-px border border-stone-200 bg-stone-200 text-center text-xs font-medium text-stone-500">
            {weekdayLabels.map((w) => (
              <div key={w} className="bg-stone-50 py-2">
                {w}
              </div>
            ))}
          </div>

          {/* Weeks */}
          <div className="grid grid-cols-7 gap-px border-x border-b border-stone-200 bg-stone-200">
            {weeks.map((week, wi) =>
              week.map((day, di) => {
                if (day === null) {
                  return (
                    <div
                      key={`${wi}-${di}`}
                      className="min-h-24 bg-stone-50/50"
                    />
                  )
                }
                const key = ymd(year, month, day)
                const dayMeetups = meetupsByDay.get(key) ?? []
                const dayHelps = helpsByDay.get(key) ?? []
                const isToday = key === todayKey
                return (
                  <div
                    key={`${wi}-${di}`}
                    className="min-h-24 bg-white p-1.5 flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs ${
                          isToday
                            ? 'flex h-5 w-5 items-center justify-center rounded-full bg-stone-900 text-stone-50'
                            : 'text-stone-500'
                        }`}
                      >
                        {day}
                      </span>
                      <DayAddButton date={key} />
                    </div>
                    <div className="flex flex-col gap-1">
                      {dayMeetups.map((m) => (
                        <Link
                          key={m.id}
                          href={`/meetups/${m.id}`}
                          title={m.title}
                          className="block truncate rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-900 hover:bg-amber-200"
                        >
                          {m.title}
                        </Link>
                      ))}
                      {dayHelps.map((h) => {
                        const ho = h.help_outs!
                        const sorted = ho.status === 'sorted'
                        return (
                          <Link
                            key={`${h.help_out_id}-${h.the_date}`}
                            href={`/helpouts/${ho.id}`}
                            title={ho.title}
                            className={`block truncate rounded px-1.5 py-0.5 text-[11px] ${
                              sorted
                                ? 'bg-stone-100 text-stone-400 hover:bg-stone-200'
                                : 'bg-green-100 text-green-900 hover:bg-green-200'
                            }`}
                          >
                            {ho.title}
                            {sorted && (
                              <span className="ml-1 text-[10px] text-stone-400">
                                (sorted)
                              </span>
                            )}
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <p className="mt-4 text-xs text-stone-400">
            Click the + on any day to add a meetup or ask for help on that date.
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
