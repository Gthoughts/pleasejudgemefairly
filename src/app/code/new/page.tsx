import Link from 'next/link'
import { redirect } from 'next/navigation'
import CodeHeader from '@/components/CodeHeader'
import SiteFooter from '@/components/SiteFooter'
import { createClient } from '@/lib/supabase/server'
import NewCipherForm from './NewCipherForm'

export const metadata = {
  title: 'Submit a code — a place for you',
}

export default async function NewCipherPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/signin?next=/code/new')

  return (
    <>
      <CodeHeader />
      <main className="flex-1 px-4 sm:px-6 py-8 sm:py-12">
        <div className="mx-auto max-w-2xl space-y-6">
          <section>
            <p className="text-sm text-stone-500">
              <Link href="/code" className="underline hover:text-stone-900">
                &larr; Code
              </Link>
            </p>
            <h1 className="mt-2 text-2xl font-semibold">Submit a code</h1>
            <p className="mt-2 text-sm text-stone-600">
              Share a cipher that has been decoded, and how it was worked out.
              Submissions go into the review queue and get published once an
              admin approves them.
            </p>
          </section>

          <NewCipherForm />
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
