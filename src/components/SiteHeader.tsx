import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { isAdminEmail } from '@/lib/admin'
import { getInboxUnreadCount } from '@/lib/inbox'
import SignOutButton from './SignOutButton'

// Top header used on the homepage and any other page that wants the
// site-wide chrome. Presents every section under one "Menu" dropdown
// so the homepage stays uncluttered and the same navigation pattern
// works on desktop and mobile. Uses a JS-free <details>/<summary> so
// it degrades gracefully.
//
// The Review queue entry is admin-only. Everyone else never sees it.

type NavItem = { href: string; label: string; adminOnly?: boolean }

const NAV: NavItem[] = [
  { href: '/discuss', label: 'Discussion' },
  { href: '/library', label: 'Library' },
  { href: '/meetups', label: 'Meetups' },
  { href: '/projects', label: 'Projects' },
  { href: '/about', label: 'How This Works' },
  { href: '/review', label: 'Review queue', adminOnly: true },
]

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

export default async function SiteHeader() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isAdmin = isAdminEmail(user?.email)
  const unread = user ? await getInboxUnreadCount(supabase) : 0

  const items = NAV.filter((i) => !i.adminOnly || isAdmin)

  return (
    <header className="border-b border-line bg-paper">
      <div className="mx-auto max-w-[760px] px-6 py-4 flex items-center justify-between gap-4">
        <Link
          href="/"
          className="font-serif text-base text-ink hover:text-moss shrink-0"
        >
          a place for you
        </Link>

        <div className="relative">
          <details className="group">
            <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer rounded border border-line px-3 py-1.5 text-sm text-ink hover:bg-paper-deep select-none min-h-[44px] flex items-center gap-2">
              <span>Menu</span>
              <InboxBadge count={unread} />
            </summary>
            <nav
              aria-label="Site menu"
              className="absolute right-0 top-full mt-1 z-20 min-w-56 rounded border border-line bg-paper shadow-md py-1 flex flex-col text-sm text-ink"
            >
              {items.map((i) => (
                <Link
                  key={i.href}
                  href={i.href}
                  className="px-4 py-3 hover:bg-paper-deep min-h-[44px] flex items-center"
                >
                  {i.label}
                </Link>
              ))}
              {user ? (
                <>
                  <Link
                    href="/inbox"
                    className="px-4 py-3 hover:bg-paper-deep min-h-[44px] flex items-center"
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
                    className="px-4 py-3 hover:bg-paper-deep min-h-[44px] flex items-center"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/signup"
                    className="px-4 py-3 hover:bg-paper-deep min-h-[44px] flex items-center"
                  >
                    Sign up
                  </Link>
                </>
              )}
              <a
                href="https://github.com/Gthoughts/pleasejudgemefairly"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-3 hover:bg-paper-deep min-h-[44px] flex items-center text-stone-500"
              >
                GitHub
              </a>
            </nav>
          </details>
        </div>
      </div>
    </header>
  )
}
