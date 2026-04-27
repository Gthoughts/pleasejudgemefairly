import Link from 'next/link'
import DiscussHeader from '@/components/DiscussHeader'
import SiteFooter from '@/components/SiteFooter'
import { CATEGORIES } from '@/lib/categories'
import { createClient } from '@/lib/supabase/server'
import { formatWhen } from '@/lib/format'

export const metadata = {
  title: 'Discussion — pleasejudgemefairly',
}

// /discuss - the four categories with a thread count and the most recent
// activity for each. Server-rendered; no caching beyond what Supabase gives
// us so counts always reflect the current state.
// Public page: anonymous visitors can see category stats but links gate on sign-in.
export default async function DiscussIndexPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const rows = await Promise.all(
    CATEGORIES.map(async (cat) => {
      const { count } = await supabase
        .from('threads')
        .select('id', { count: 'exact', head: true })
        .eq('category', cat.slug)

      const { data: latest } = await supabase
        .from('threads')
        .select('id, title, updated_at')
        .eq('category', cat.slug)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      return { ...cat, count: count ?? 0, latest }
    })
  )

  return (
    <>
      <DiscussHeader />
      <main className="flex-1 px-6 py-12">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-2xl font-semibold">Discussion</h1>
          <p className="mt-2 text-sm text-stone-600">
            Pick a category.
          </p>

          {!user && (
            <p className="mt-4 text-sm text-stone-500">
              <Link href="/signin" className="underline hover:text-stone-900">
                Sign in
              </Link>{' '}
              to read discussions or join in.
            </p>
          )}

          <ul className="mt-8 divide-y divide-stone-200 border-y border-stone-200">
            {rows.map((row) => {
              const categoryHref = user
                ? `/discuss/${row.slug}`
                : `/signin?next=/discuss/${row.slug}`
              return (
                <li key={row.slug} className="py-5">
                  <Link
                    href={categoryHref}
                    className="text-lg font-medium hover:underline"
                  >
                    {row.name}
                  </Link>
                  <p className="mt-1 text-sm text-stone-500">
                    {row.count} {row.count === 1 ? 'thread' : 'threads'}
                    {row.latest ? (
                      <> · last activity {formatWhen(row.latest.updated_at)}</>
                    ) : null}
                  </p>
                  {row.latest && (
                    <p className="mt-1 text-sm text-stone-600">
                      Most recent:{' '}
                      <Link
                        href={
                          user
                            ? `/discuss/${row.slug}/${row.latest.id}`
                            : `/signin?next=/discuss/${row.slug}/${row.latest.id}`
                        }
                        className="underline underline-offset-4 hover:text-stone-900"
                      >
                        {row.latest.title}
                      </Link>
                    </p>
                  )}
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
