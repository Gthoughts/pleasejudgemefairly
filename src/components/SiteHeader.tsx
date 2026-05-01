import Link from 'next/link'

// Top header for the homepage. Quiet site-name on the left,
// core nav links on the right.
// On mobile: a "Menu" disclosure button opens a dropdown list.
// On md+: links run horizontally as normal.
export default function SiteHeader() {
  return (
    <header className="border-b border-stone-200 bg-stone-50">
      <div className="mx-auto max-w-4xl px-6 py-4 flex items-center justify-between gap-4">
        <Link href="/" className="font-medium hover:text-stone-600 shrink-0">
          pleasejudgemefairly
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-4 text-sm text-stone-900">
          <Link href="/library" className="hover:underline">Library</Link>
          <Link href="/meetups" className="hover:underline">Meetups</Link>
          <Link href="/about" className="hover:underline">How This Works</Link>
          <a
            href="https://github.com/Gthoughts/pleasejudgemefairly"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            GitHub
          </a>
          <Link
            href="/signup"
            className="rounded bg-stone-900 text-stone-50 px-3 py-1.5 hover:bg-stone-700"
          >
            Join us
          </Link>
        </nav>

        {/* Mobile dropdown — no JS, uses <details>/<summary> */}
        <div className="relative md:hidden">
          <details className="group">
            <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer rounded border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-100 select-none">
              Menu
            </summary>
            <nav className="absolute right-0 top-full mt-1 z-20 min-w-44 rounded border border-stone-200 bg-stone-50 shadow-md py-1 flex flex-col text-sm text-stone-900">
              <Link href="/library" className="px-4 py-2.5 hover:bg-stone-100">Library</Link>
              <Link href="/meetups" className="px-4 py-2.5 hover:bg-stone-100">Meetups</Link>
              <Link href="/about" className="px-4 py-2.5 hover:bg-stone-100">How This Works</Link>
              <a
                href="https://github.com/Gthoughts/pleasejudgemefairly"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 hover:bg-stone-100"
              >
                GitHub
              </a>
              <div className="mx-3 my-1 border-t border-stone-200" />
              <Link
                href="/signup"
                className="mx-3 mb-1 rounded bg-stone-900 text-stone-50 px-3 py-2 text-center hover:bg-stone-700"
              >
                Join us
              </Link>
            </nav>
          </details>
        </div>
      </div>
    </header>
  )
}
