import Link from 'next/link'
import LibraryHeader from '@/components/LibraryHeader'
import SiteFooter from '@/components/SiteFooter'
import { createClient } from '@/lib/supabase/server'
import { LIBRARY_CATEGORIES } from '@/lib/library-categories'
import { LIBRARY_SUBJECTS } from '@/lib/library-subjects'

export const metadata = {
  title: 'Library — a place for you',
}

// Library index. Shows the six categories with a resource count each.
// Held resources are excluded from the count (same logic as held posts
// being filtered from the default thread view).
export default async function LibraryPage() {
  const supabase = await createClient()

  // One query - pull category + subject for all non-held resources.
  const { data: rows } = await supabase
    .from('resources')
    .select('category, subject')
    .neq('hold_state', 'held')
    .returns<{ category: string; subject: string | null }[]>()

  const countMap = new Map<string, number>()
  const subjectCountMap = new Map<string, number>()
  for (const r of rows ?? []) {
    countMap.set(r.category, (countMap.get(r.category) ?? 0) + 1)
    if (r.subject) {
      subjectCountMap.set(
        r.subject,
        (subjectCountMap.get(r.subject) ?? 0) + 1
      )
    }
  }

  return (
    <>
      <LibraryHeader />
      <main className="flex-1 px-4 sm:px-6 py-8 sm:py-12">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-2xl font-semibold">Library</h1>
          <p className="mt-2 text-sm text-stone-600">
            Resources submitted by the community: books, articles, films, and
            more. No advertising, no affiliate links, no money-making — the
            same rules as everywhere else on this site.
          </p>

          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
              Browse by format
            </h2>
            <ul className="mt-3 divide-y divide-stone-200 border-y border-stone-200">
              {LIBRARY_CATEGORIES.map((cat) => {
                const n = countMap.get(cat.slug) ?? 0
                return (
                  <li key={cat.slug}>
                    <Link
                      href={`/library/${cat.slug}`}
                      className="flex items-center justify-between py-4 -mx-2 px-2 rounded hover:bg-stone-50"
                    >
                      <span className="font-medium text-stone-800">
                        {cat.name}
                      </span>
                      <span className="text-sm text-stone-500">
                        {n === 0
                          ? 'no resources yet'
                          : n === 1
                            ? '1 resource'
                            : `${n} resources`}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>

          <section className="mt-12">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
                Browse by topic
              </h2>
              <Link
                href="/library/topic"
                className="text-xs text-stone-500 underline hover:text-stone-800"
              >
                see all
              </Link>
            </div>
            <ul className="mt-3 divide-y divide-stone-200 border-y border-stone-200">
              {LIBRARY_SUBJECTS.map((s) => {
                const n = subjectCountMap.get(s.slug) ?? 0
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
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
