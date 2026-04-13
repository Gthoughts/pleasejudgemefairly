import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from './SignOutButton'

// Header for library pages. Same structure as DiscussHeader but
// highlights Library in the nav.
export default async function LibraryHeader() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <header className="border-b border-stone-200 bg-stone-50">
      <div className="mx-auto max-w-4xl px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-medium hover:text-stone-600">
          pleasejudgemefairly
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <Link href="/library" className="hover:underline">
            Library
          </Link>
          <Link href="/discuss" className="hover:underline">
            Discussion
          </Link>
          <Link href="/review" className="hover:underline">
            Review queue
          </Link>
          {user ? (
            <>
              <Link href="/inbox" className="hover:underline">
                Inbox
              </Link>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link href="/signin" className="hover:underline">
                Sign in
              </Link>
              <Link href="/signup" className="hover:underline">
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
