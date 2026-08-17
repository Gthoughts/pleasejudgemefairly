import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import ThisIsMeHeader from '@/components/ThisIsMeHeader'
import SiteFooter from '@/components/SiteFooter'
import { createClient } from '@/lib/supabase/server'
import {
  getEntriesForUser,
  getOwnLovedEntryIds,
  getCommentsForEntries,
} from '@/lib/this-is-me/queries'
import EntryList from './EntryList'
import AddEntryButton from './AddEntryButton'

export const metadata = {
  title: 'This is me — a place for you',
}

const INTRO =
  "Here is a place for you to tell your story — whatever you are comfortable sharing. Highs and lows are all that have made you you, and others would love to hear how you found your way here and what your journey so far has been like. And finally: what's your vision for the future?"

export default async function StoryPage(
  props: PageProps<'/thisisme/[username]'>
) {
  const { username } = await props.params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/signin?next=/thisisme/${username}`)

  const { data: owner } = await supabase
    .from('users')
    .select('id, username')
    .eq('username', username)
    .maybeSingle<{ id: string; username: string }>()
  if (!owner) notFound()

  const isOwner = owner.id === user.id
  const entries = await getEntriesForUser(supabase, owner.id)
  const entryIds = entries.map((e) => e.id)
  const [myLoves, commentsByEntry] = await Promise.all([
    getOwnLovedEntryIds(supabase, entryIds, user.id),
    getCommentsForEntries(supabase, entryIds),
  ])

  return (
    <>
      <ThisIsMeHeader />
      <main className="flex-1 px-4 sm:px-6 py-8 sm:py-12">
        <div className="mx-auto max-w-2xl space-y-8">
          <section>
            <p className="text-sm text-stone-500">
              <Link href="/thisisme" className="underline hover:text-stone-900">
                &larr; This is me
              </Link>
            </p>
            <h1 className="mt-2 text-2xl font-semibold">{owner.username}</h1>
          </section>

          <div className="rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <strong>DO NOT share any personal data here.</strong> Please use your
            username, not your real name.
          </div>

          {isOwner && entries.length === 0 ? (
            <p className="text-sm text-stone-700 leading-relaxed">{INTRO}</p>
          ) : null}

          <EntryList
            entries={entries}
            isOwner={isOwner}
            currentUserId={user.id}
            username={owner.username}
            myLovedIds={Array.from(myLoves)}
            commentsByEntry={Object.fromEntries(commentsByEntry)}
          />

          {isOwner ? <AddEntryButton username={owner.username} /> : null}
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
