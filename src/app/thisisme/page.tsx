import { redirect } from 'next/navigation'
import ThisIsMeHeader from '@/components/ThisIsMeHeader'
import SiteFooter from '@/components/SiteFooter'
import { createClient } from '@/lib/supabase/server'
import { listStorytellers } from '@/lib/this-is-me/queries'
import LandingList from './LandingList'

export const metadata = {
  title: 'This is me — a place for you',
}

export default async function ThisIsMePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/signin?next=/thisisme')

  // Look up the current user's username so the "Your story" button
  // routes to the right place even if they have no entries yet.
  const { data: me } = await supabase
    .from('users')
    .select('username')
    .eq('id', user.id)
    .maybeSingle<{ username: string }>()
  const myUsername = me?.username ?? null

  const storytellers = await listStorytellers(supabase)

  return (
    <>
      <ThisIsMeHeader />
      <main className="flex-1 px-4 sm:px-6 py-8 sm:py-12">
        <div className="mx-auto max-w-2xl space-y-8">
          <section>
            <h1 className="text-2xl font-semibold">This is me</h1>
            <p className="mt-2 text-sm text-stone-600">
              A place to tell your story, entry by entry. Others can find
              yours here.
            </p>
          </section>

          <LandingList
            storytellers={storytellers}
            myUsername={myUsername}
          />
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
