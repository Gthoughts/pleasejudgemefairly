import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { isAdminEmail } from '@/lib/admin'
import { getInboxUnreadCount } from '@/lib/inbox'
import SignOutButton from './SignOutButton'

// Shared top header for the section pages (/discuss, /library, /meetups,
// /projects, /inbox, /review). Small brand link on the left; the section
// nav collapses into a JS-free <details>/<summary> menu below the sm
// breakpoint so it stays usable on mobile.
//
// The `current` prop just tells the caller which section to feature at
// the top of the list. Everything else is identical between sections.
type Current =
  | 'discuss'
  | 'library'
  | 'videos'
  | 'meetups'
  | 'projects'
  | 'inbox'
  | 'review'

type NavItem = {
  key: Current | 'about'
  href: string
  label: string
  adminOnly?: boolean
}

const ALL_NAV: NavItem[] = [
  { key: 'discuss', href: '/discuss', label: 'Discussion' },
  { key: 'library', href: '/library', label: 'Library' },
  { key: 'videos', href: '/videos', label: 'Videos' },
  { key: 'meetups', href: '/meetups', label: 'Meetups' },
  { key: 'projects', href: '/projects', label: 'Projects' },
  { key: 'about', href: '/about', label: 'How This Works' },
  { key: 'review', href: '/review', label: 'Review queue', adminOnly: true },
]

// A pill next to the Inbox link when there are unread replies.
// Deliberately quiet — stone-800 on stone-200 so it registers as a
// count, not an alarm.
function InboxBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span
      aria-label={`${count} unread ${count === 1 ? 'reply' : 'replies'}`}
      className="ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-stone-800 px-1.5 py-0.5 text-[11px] font-medium leading-none text-stone-50"
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}

export default async function SectionHeader({
  current,
}: {
  current: Current
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Only fetch the unread count if the user is signed in. Silently
  // returns 0 if the phase10 migration hasn't been applied yet, so
  // the header still renders during a rolling deploy.
  const unread = user ? await getInboxUnreadCount(supabase) : 0
  const isAdmin = isAdminEmail(user?.email)

  // Put the current section first so it reads as the active one.
  // Drop admin-only entries (Review queue) for non-admins.
  const visible = ALL_NAV.filter((i) => !i.adminOnly || isAdmin)
  const items = [
    ...visible.filter((i) => i.key === current),
    ...visible.filter((i) => i.key !== current),
  ]

  return (
    <header className="border-b border-stone-200 bg-stone-50">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
        <Link
          href="/"
          className="font-medium text-stone-900 hover:text-stone-600 shrink-0"
        >
          a place for you
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-x-5 gap-y-2 flex-wrap text-sm text-stone-900">
          {items.map((i) => (
            <Link
              key={i.key}
              href={i.href}
              className={
                i.key === current
                  ? 'font-medium hover:underline'
                  : 'hover:underline'
              }
            >
              {i.label}
            </Link>
          ))}
          {user ? (
            <>
              <Link
                href="/inbox"
                className="inline-flex items-center hover:underline"
              >
                Inbox
                <InboxBadge count={unread} />
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

        {/* Mobile dropdown — no JS, keyboard accessible */}
        <div className="relative md:hidden">
          <details className="group">
            <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer rounded border border-stone-300 px-3 py-1.5 text-sm text-stone-900 hover:bg-stone-100 select-none min-h-[44px] flex items-center gap-2">
              <span>Menu</span>
              <InboxBadge count={unread} />
            </summary>
            <nav
              aria-label="Section menu"
              className="absolute right-0 top-full mt-1 z-20 min-w-56 rounded border border-stone-200 bg-white shadow-md py-1 flex flex-col text-sm text-stone-900"
            >
              {items.map((i) => (
                <Link
                  key={i.key}
                  href={i.href}
                  className={
                    'px-4 py-3 hover:bg-stone-100 min-h-[44px] flex items-center ' +
                    (i.key === current ? 'font-medium' : '')
                  }
                >
                  {i.label}
                </Link>
              ))}
              {user ? (
                <>
                  <Link
                    href="/inbox"
                    className="px-4 py-3 hover:bg-stone-100 min-h-[44px] flex items-center"
                  >
                    Inbox
                    <InboxBadge count={unread} />
                  </Link>
                  <div className="px-4 py-3">
                    <SignOutButton />
                  </div>
                </>
              ) : (
                <>
                  <Link
                    href="/signin"
                    className="px-4 py-3 hover:bg-stone-100 min-h-[44px] flex items-center"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/signup"
                    className="px-4 py-3 hover:bg-stone-100 min-h-[44px] flex items-center"
                  >
                    Sign up
                  </Link>
                </>
              )}
            </nav>
          </details>
        </div>
      </div>
    </header>
  )
}
