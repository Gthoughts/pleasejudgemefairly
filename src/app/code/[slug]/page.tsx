import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import CodeHeader from '@/components/CodeHeader'
import SiteFooter from '@/components/SiteFooter'
import { createClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'Code — a place for you',
}

type CipherDetail = {
  id: string
  slug: string
  title: string
  summary: string
  cipher_text: string
  decoded_reading: string
  method: string
  sources: string | null
  animation_slug: string | null
  status: 'pending' | 'published' | 'rejected'
  submitter_id: string
  users: { username: string } | null
}

export default async function CodeDetailPage(props: PageProps<'/code/[slug]'>) {
  const { slug } = await props.params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/signin?next=/code/${slug}`)

  const { data: cipher } = await supabase
    .from('code_ciphers')
    .select(
      'id, slug, title, summary, cipher_text, decoded_reading, method, sources, animation_slug, status, submitter_id, users:submitter_id(username)'
    )
    .eq('slug', slug)
    .maybeSingle<CipherDetail>()

  if (!cipher) notFound()

  const isPending = cipher.status === 'pending'
  const submitterUsername = cipher.users?.username ?? 'unknown'

  return (
    <>
      <CodeHeader />
      <main className="flex-1 px-4 sm:px-6 py-8 sm:py-12">
        <div className="mx-auto max-w-2xl space-y-10">
          <section>
            <p className="text-sm text-stone-500">
              <Link href="/code" className="underline hover:text-stone-900">
                &larr; Code
              </Link>
            </p>

            {isPending && (
              <div className="mt-3 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                This submission is still waiting to be reviewed. Only you and
                admins can see it right now.
              </div>
            )}

            <h1 className="mt-2 text-2xl font-semibold">{cipher.title}</h1>
            <p className="mt-2 text-sm text-stone-600">{cipher.summary}</p>
            <p className="mt-2 text-xs text-stone-400">
              Submitted by {submitterUsername}
            </p>
          </section>

          <section>
            <h2 className="text-sm font-medium text-stone-700">The cipher</h2>
            <pre className="mt-2 whitespace-pre-wrap break-words rounded bg-stone-50 border border-stone-200 p-4 text-sm text-stone-800 font-mono">
              {cipher.cipher_text}
            </pre>
          </section>

          {cipher.animation_slug ? (
            <section>
              <h2 className="text-sm font-medium text-stone-700">How it reads</h2>
              <div className="mt-2 aspect-video overflow-hidden rounded border border-stone-800 bg-black">
                <iframe
                  src={`/code-assets/${cipher.animation_slug}/index.html`}
                  title={`${cipher.title} animation`}
                  className="h-full w-full"
                  allow="autoplay"
                  loading="lazy"
                />
              </div>
            </section>
          ) : null}

          <section>
            <h2 className="text-sm font-medium text-stone-700">Decoded reading</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-stone-800">
              {cipher.decoded_reading}
            </p>
          </section>

          <section>
            <h2 className="text-sm font-medium text-stone-700">Method</h2>
            <div className="mt-2 whitespace-pre-wrap text-sm text-stone-800 leading-relaxed">
              {cipher.method}
            </div>
          </section>

          {cipher.sources ? (
            <section>
              <h2 className="text-sm font-medium text-stone-700">Sources</h2>
              <div className="mt-2 whitespace-pre-wrap text-sm text-stone-600">
                {cipher.sources}
              </div>
            </section>
          ) : null}
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
