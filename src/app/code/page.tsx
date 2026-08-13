import Link from 'next/link'
import { redirect } from 'next/navigation'
import CodeHeader from '@/components/CodeHeader'
import SiteFooter from '@/components/SiteFooter'
import { createClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'Code — a place for you',
}

type CipherRow = {
  id: string
  slug: string
  title: string
  summary: string
  animation_slug: string | null
  status: 'pending' | 'published' | 'rejected'
  created_at: string
}

export default async function CodePage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>
}) {
  const sp = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/signin?next=/code')

  // RLS returns published rows for everyone plus the user's own pending
  // ones, so we can render them together and just mark pending ones as
  // "waiting for review".
  const { data: rows } = await supabase
    .from('code_ciphers')
    .select('id, slug, title, summary, animation_slug, status, created_at')
    .order('created_at', { ascending: false })
    .returns<CipherRow[]>()

  const ciphers = rows ?? []
  const published = ciphers.filter((c) => c.status === 'published')
  const myPending = ciphers.filter((c) => c.status === 'pending')

  return (
    <>
      <CodeHeader />
      <main className="flex-1 px-4 sm:px-6 py-8 sm:py-12">
        <div className="mx-auto max-w-2xl space-y-10">
          <section>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold">Code</h1>
                <p className="mt-1 text-sm text-stone-500">
                  Broken codes and how they were decoded. Submit one you&rsquo;ve
                  worked out and it goes into the review queue.
                </p>
              </div>
              <Link
                href="/code/new"
                className="shrink-0 rounded border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:border-stone-500 hover:text-stone-900"
              >
                Submit a code
              </Link>
            </div>

            {sp.submitted && (
              <div className="mt-4 rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                Thanks, your submission is in the review queue.
              </div>
            )}
          </section>

          {myPending.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-stone-700">
                Your submissions, waiting for review
              </h2>
              <ul className="mt-2 divide-y divide-stone-200 border-y border-stone-200">
                {myPending.map((c) => (
                  <li key={c.id} className="py-3">
                    <p className="text-sm font-medium text-stone-800">{c.title}</p>
                    <p className="mt-0.5 text-xs text-stone-500">{c.summary}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            {published.length === 0 ? (
              <p className="text-sm text-stone-500">
                Nothing published yet. Be the first to share one.
              </p>
            ) : (
              <ul className="divide-y divide-stone-200 border-y border-stone-200">
                {published.map((c) => (
                  <li key={c.id} className="py-5">
                    <Link
                      href={`/code/${c.slug}`}
                      className="text-base font-medium text-stone-800 hover:underline"
                    >
                      {c.title}
                    </Link>
                    <p className="mt-1 text-sm text-stone-500">{c.summary}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
