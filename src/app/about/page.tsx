import SiteFooter from '@/components/SiteFooter'
import Link from 'next/link'

// Placeholder "How This Works" page. Wayne will draft the real copy in his
// own voice during a later phase.
export const metadata = {
  title: 'How This Works — pleasejudgemefairly',
}

export default function AboutPage() {
  return (
    <>
      <main className="flex-1 px-6 py-16">
        <article className="mx-auto max-w-2xl prose prose-stone">
          <h1 className="text-3xl font-semibold">How This Works</h1>
          <p className="mt-6 text-stone-700">
            This page is a placeholder. The real explanation — what this site
            is, the one rule, who runs it, the AGPL licence, the commitment to
            hand over commit rights once the community reaches a defined
            size — will live here.
          </p>
          <p className="mt-4 text-stone-700">
            In the meantime, the code is public and anyone is free to fork it
            and run their own version.
          </p>
          <p className="mt-8">
            <Link
              href="/"
              className="underline underline-offset-4 text-stone-900 hover:text-stone-600"
            >
              ← back home
            </Link>
          </p>
        </article>
      </main>
      <SiteFooter />
    </>
  )
}
