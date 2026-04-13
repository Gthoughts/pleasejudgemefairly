import Link from 'next/link'
import { notFound } from 'next/navigation'
import DiscussHeader from '@/components/DiscussHeader'
import SiteFooter from '@/components/SiteFooter'
import { getCategory } from '@/lib/categories'
import { createClient } from '@/lib/supabase/server'
import { formatWhen } from '@/lib/format'

type ThreadRow = {
  id: string
  title: string
  created_at: string
  updated_at: string
  author_id: string
  users: { username: string } | null
  posts: { count: number }[]
}

export default async function CategoryPage(
  props: PageProps<'/discuss/[category]'>
) {
  const { category } = await props.params
  const search = await props.searchParams
  const sort = typeof search.sort === 'string' ? search.sort : 'newest'

  const cat = getCategory(category)
  if (!cat) notFound()

  const supabase = await createClient()

  const { data } = await supabase
    .from('threads')
    .select(
      'id, title, created_at, updated_at, author_id, users:author_id(username), posts(count)'
    )
    .eq('category', category)
    .returns<ThreadRow[]>()

  const threads = data ?? []

  const sorted = threads.slice().sort((a, b) => {
    if (sort === 'most-discussed') {
      const ac = a.posts?.[0]?.count ?? 0
      const bc = b.posts?.[0]?.count ?? 0
      if (bc !== ac) return bc - ac
    }
    return (
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  })

  return (
    <>
      <DiscussHeader />
      <main className="flex-1 px-6 py-12">
        <div className="mx-auto max-w-2xl">
          <p className="text-sm text-stone-500">
            <Link href="/discuss" className="underline hover:text-stone-900">
              ← Discussion
            </Link>
          </p>
          <div className="mt-1 flex items-start justify-between gap-4">
            <h1 className="text-2xl font-semibold">{cat.name}</h1>
            <Link
              href={`/discuss/${category}/new`}
              className="rounded bg-stone-900 text-stone-50 px-4 py-2 text-sm hover:bg-stone-700"
            >
              New thread
            </Link>
          </div>

          <div className="mt-6 text-sm flex items-center gap-4">
            <span className="text-stone-500">Sort:</span>
            <Link
              href={`/discuss/${category}`}
              className={
                sort !== 'most-discussed'
                  ? 'font-medium text-stone-900'
                  : 'text-stone-600 hover:underline'
              }
            >
              Newest
            </Link>
            <Link
              href={`/discuss/${category}?sort=most-discussed`}
              className={
                sort === 'most-discussed'
                  ? 'font-medium text-stone-900'
                  : 'text-stone-600 hover:underline'
              }
            >
              Most discussed
            </Link>
          </div>

          <ul className="mt-6 divide-y divide-stone-200 border-y border-stone-200">
            {sorted.map((t) => {
              const totalPosts = t.posts?.[0]?.count ?? 1
              const replies = Math.max(totalPosts - 1, 0)
              return (
                <li key={t.id} className="py-4">
                  <Link
                    href={`/discuss/${category}/${t.id}`}
                    className="text-base font-medium hover:underline"
                  >
                    {t.title}
                  </Link>
                  <p className="mt-1 text-sm text-stone-500">
                    by {t.users?.username ?? 'unknown'} ·{' '}
                    {formatWhen(t.created_at)} · {replies}{' '}
                    {replies === 1 ? 'reply' : 'replies'}
                  </p>
                </li>
              )
            })}
            {sorted.length === 0 && (
              <li className="py-8 text-sm text-stone-500">
                No threads yet. Start one.
              </li>
            )}
          </ul>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
