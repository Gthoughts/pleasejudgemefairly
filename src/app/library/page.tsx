import Link from 'next/link'
import LibraryHeader from '@/components/LibraryHeader'
import SiteFooter from '@/components/SiteFooter'
import { createClient } from '@/lib/supabase/server'
import { LIBRARY_CATEGORIES } from '@/lib/library-categories'

export const metadata = {
  title: 'Library — pleasejudgemefairly',
}

// Library index. Shows the six categories with a resource count each.
// Held resources are excluded from the count (same logic as held posts
// being filtered from the default thread view).
export default async function LibraryPage() {
  const supabase = await createClient()

  // One query - pull just category column for all non-held resources.
  const { data: rows } = await supabase
    .from('resources')
    .select('category')
    .neq('hold_state', 'held')
    .returns<{ category: string }[]>()

  const countMap = new Map<string, number>()
  for (const r of rows ?? []) {
    countMap.set(r.category, (countMap.get(r.category) ?? 0) + 1)
  }

  return (
    <>
      <LibraryHeader />
      <main className="flex-1 px-6 py-12">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-2xl font-semibold">Library</h1>
          <p className="mt-2 text-sm text-stone-600">
            Resources submitted by the community: books, articles, films, and
            more. No advertising, no affiliate links, no money-making — the
            same rules as everywhere else on this site.
          </p>

          <ul className="mt-8 divide-y divide-stone-200 border-y border-stone-200">
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
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
