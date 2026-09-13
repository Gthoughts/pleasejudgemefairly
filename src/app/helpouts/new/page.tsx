import { redirect } from 'next/navigation'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'
import { createClient } from '@/lib/supabase/server'
import NewHelpOutForm from './NewHelpOutForm'

export const metadata = {
  title: 'Ask for help — a place for you',
}

export default async function NewHelpOutPage(props: PageProps<'/helpouts/new'>) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/signin?next=/helpouts/new')

  const sp = await props.searchParams
  const defaultDate =
    typeof sp.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(sp.date)
      ? sp.date
      : undefined

  return (
    <>
      <SiteHeader />
      <main className="flex-1 px-4 sm:px-6 py-8 sm:py-12">
        <div className="mx-auto max-w-2xl">
          <p className="text-sm text-stone-500">
            <a href="/helpouts" className="underline hover:text-stone-900">
              ← Help Out
            </a>
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Ask for help</h1>
          <p className="mt-2 text-sm text-stone-600">
            Describe the practical help you need. You can post for yourself or on
            someone&rsquo;s behalf. Share only a general area here, never your full
            address: you can share the exact address privately with a helper by
            messaging them once someone offers.
          </p>
          <div className="mt-8">
            <NewHelpOutForm defaultDate={defaultDate} />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
