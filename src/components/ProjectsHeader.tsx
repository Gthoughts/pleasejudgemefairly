import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from './SignOutButton'

// Header for project pages. Same structure as the other section headers
// but highlights Projects first in the nav.
export default async function ProjectsHeader() {
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
        <nav className="flex items-center gap-5 text-sm text-stone-900">
          <Link href="/projects" className="hover:underline">
            Projects
          </Link>
          <Link href="/meetups" className="hover:underline">
            Meetups
          </Link>
          <Link href="/discuss" className="hover:underline">
            Discussion
          </Link>
          <Link href="/library" className="hover:underline">
            Library
          </Link>
          <Link href="/about" className="hover:underline">
            How This Works
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
