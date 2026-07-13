import Link from 'next/link'
import LibraryHeader from '@/components/LibraryHeader'
import SiteFooter from '@/components/SiteFooter'
import { createClient } from '@/lib/supabase/server'
import { LIBRARY_SUBJECTS } from '@/lib/library-subjects'

export const metadata = {
  title: 'Browse by topic — Library — a place for you',
}

export default async function LibraryTopicsIndexPage() {
  const supabase = await createClient()

  const { data: rows } = await supabase
    .from('resources')
    .select('subject')
    .neq('hold_state', 'held')
    .returns<{ subject: string | null }[]>()

  const counts = new Map<string, number>()
  for (const r of rows ?? []) {
    if (!r.subject) continue
    counts.set(r.subject, (counts.get(r.subject) ?? 0) + 1)
  }

  return (
    <>
      <LibraryHeader />
      <main className="flex-1 px-4 sm:px-6 py-8 sm:py-12">
        <div className="mx-auto max-w-2xl">
          <p className="text-sm text-stone-500">
            <Link href="/library" className="underline hover:text-stone-900">
              ← Library
            </Link>
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Browse by topic</h1>
          <p className="mt-2 text-sm text-stone-600">
            Every book, article, documentary, and video that shares a
            topic, gathered in one place.
          </p>

          <ul className="mt-8 divide-y divide-stone-200 border-y border-stone-200">
            {LIBRARY_SUBJECTS.map((s) => {
              const n = counts.get(s.slug) ?? 0
              return (
                <li key={s.slug}>
                  <Link
                    href={`/library/topic/${s.slug}`}
                    className="flex items-center justify-between py-4 -mx-2 px-2 rounded hover:bg-stone-50"
                  >
                    <span className="font-medium text-stone-800">
                      {s.name}
                    </span>
                    <span className="text-sm text-stone-500">
                      {n === 0
                        ? 'nothing yet'
                        : n === 1
                          ? '1 resource'
                          : `${n} resources`}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
