import Link from 'next/link'
import { notFound } from 'next/navigation'
import LibraryHeader from '@/components/LibraryHeader'
import SiteFooter from '@/components/SiteFooter'
import { createClient } from '@/lib/supabase/server'
import { getLibrarySubject } from '@/lib/library-subjects'
import {
  LIBRARY_CATEGORIES,
  getLibraryCategory,
} from '@/lib/library-categories'
import { formatWhen } from '@/lib/format'
import { getAdminUserIds, getDisplayUsername } from '@/lib/admin'

type ResourceRow = {
  id: string
  title: string
  url: string | null
  pdf_path: string | null
  description: string
  category: string
  created_at: string
  hold_state: string
  is_collapsed: boolean
  broken_flag_count: number
  broken_confirmed: boolean | null
  rating_count: number
  submitter_id: string
  users: { username: string } | null
}

export async function generateMetadata(
  props: PageProps<'/library/topic/[topic]'>
) {
  const { topic } = await props.params
  const s = getLibrarySubject(topic)
  if (!s) return {}
  return { title: `${s.name} — Library — a place for you` }
}

export default async function LibraryTopicPage(
  props: PageProps<'/library/topic/[topic]'>
) {
  const { topic } = await props.params
  const subject = getLibrarySubject(topic)
  if (!subject) notFound()

  const supabase = await createClient()
  const { data } = await supabase
    .from('resources')
    .select(
      'id, title, url, pdf_path, description, category, created_at, hold_state, is_collapsed, broken_flag_count, broken_confirmed, rating_count, submitter_id, users:submitter_id(username)'
    )
    .eq('subject', subject.slug)
    .order('created_at', { ascending: false })
    .limit(200)
    .returns<ResourceRow[]>()

  const resources = data ?? []
  const adminIds = await getAdminUserIds()

  const grouped = new Map<string, ResourceRow[]>()
  for (const r of resources) {
    const list = grouped.get(r.category) ?? []
    list.push(r)
    grouped.set(r.category, list)
  }

  return (
    <>
      <LibraryHeader />
      <main className="flex-1 px-4 sm:px-6 py-8 sm:py-12">
        <div className="mx-auto max-w-2xl">
          <p className="text-sm text-stone-500">
            <Link
              href="/library/topic"
              className="underline hover:text-stone-900"
            >
              ← Topics
            </Link>
          </p>

          <h1 className="mt-1 text-2xl font-semibold">{subject.name}</h1>
          <p className="mt-2 text-sm text-stone-600">
            Everything filed under {subject.name.toLowerCase()} — books,
            articles, documentaries, videos, and more.
          </p>

          {resources.length === 0 ? (
            <p className="mt-10 text-sm text-stone-500">
              Nothing tagged {subject.name.toLowerCase()} yet.
            </p>
          ) : (
            <div className="mt-8 flex flex-col gap-8">
              {LIBRARY_CATEGORIES.map((cat) => {
                const list = grouped.get(cat.slug) ?? []
                if (list.length === 0) return null
                return (
                  <div key={cat.slug}>
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
                      <Link
                        href={`/library/${cat.slug}`}
                        className="hover:underline"
                      >
                        {cat.name}
                      </Link>
                      <span className="ml-2 text-xs text-stone-400">
                        ({list.length})
                      </span>
                    </h2>
                    <ul className="mt-2 divide-y divide-stone-200 border-y border-stone-200">
                      {list.map((r) => renderRow(r, adminIds))}
                    </ul>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  )
}

function renderRow(r: ResourceRow, adminIds: Set<string>) {
  const cat = getLibraryCategory(r.category)
  const href = `/library/${r.category}/${r.id}`

  if (r.is_collapsed) {
    return (
      <li key={r.id} className="py-5">
        <div className="rounded border border-dashed border-stone-300 bg-stone-50 px-4 py-3 text-sm text-stone-500">
          resource collapsed by community &middot;{' '}
          <Link href={href} className="underline hover:text-stone-800">
            view anyway
          </Link>
        </div>
      </li>
    )
  }

  return (
    <li key={r.id} className="py-5">
      <Link
        href={href}
        className="font-medium text-stone-800 hover:underline"
      >
        {r.title}
      </Link>
      {r.pdf_path && (
        <span className="ml-2 inline-flex items-center gap-1 rounded bg-stone-100 px-1.5 py-0.5 align-middle text-xs text-stone-600">
          <span aria-hidden>↓</span> PDF
        </span>
      )}
      <p className="mt-1 text-xs text-stone-500">
        {getDisplayUsername(
          r.submitter_id,
          r.users?.username ?? 'unknown',
          adminIds
        )}
        <span className="mx-1">·</span>
        <time dateTime={r.created_at}>{formatWhen(r.created_at)}</time>
        {cat && (
          <>
            <span className="mx-1">·</span>
            {cat.name}
          </>
        )}
      </p>
      <p className="mt-1 text-sm text-stone-600 line-clamp-2">
        {r.description}
      </p>
    </li>
  )
}
