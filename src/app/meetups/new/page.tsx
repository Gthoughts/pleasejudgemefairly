import { redirect } from 'next/navigation'
import MeetupsHeader from '@/components/MeetupsHeader'
import SiteFooter from '@/components/SiteFooter'
import { createClient } from '@/lib/supabase/server'
import NewMeetupForm from './NewMeetupForm'

export const metadata = {
  title: 'Organise a meetup — pleasejudgemefairly',
}

export default async function NewMeetupPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/signin?next=/meetups/new')

  return (
    <>
      <MeetupsHeader />
      <main className="flex-1 px-6 py-12">
        <div className="mx-auto max-w-2xl">
          <p className="text-sm text-stone-500">
            <a href="/meetups" className="underline hover:text-stone-900">
              ← Meetups
            </a>
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Organise a meetup</h1>
          <p className="mt-2 text-sm text-stone-600">
            All coordination happens publicly in the meetup discussion thread.
            No payments, no private messages.
          </p>
          <div className="mt-8">
            <NewMeetupForm />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
