import Link from 'next/link'

// Top header for The Accord. Used on the About page and any other
// non-homepage view that wants the site-wide chrome. The homepage
// (RegionLanding) has its own masthead and does not use this header.
//
// Mobile collapses the nav into a <details>/<summary> dropdown so it
// works without JavaScript.
export default function SiteHeader() {
  return (
    <header className="border-b border-line bg-paper">
      <div className="mx-auto max-w-[760px] px-6 py-4 flex items-center justify-between gap-4">
        <Link
          href="/"
          className="font-serif text-base text-ink hover:text-moss shrink-0"
        >
          a place for you
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-5 text-sm text-ink">
          <Link href="/library" className="hover:underline">
            Library
          </Link>
          <Link href="/about" className="hover:underline">
            About
          </Link>
          <a
            href="https://github.com/Gthoughts/pleasejudgemefairly"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            GitHub
          </a>
        </nav>

        {/* Mobile dropdown — pure HTML, no JS. */}
        <div className="relative md:hidden">
          <details className="group">
            <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer rounded border border-line px-3 py-1.5 text-sm text-ink hover:bg-paper-deep select-none">
              Menu
            </summary>
            <nav className="absolute right-0 top-full mt-1 z-20 min-w-44 rounded border border-line bg-paper shadow-md py-1 flex flex-col text-sm text-ink">
              <Link href="/library" className="px-4 py-2.5 hover:bg-paper-deep">
                Library
              </Link>
              <Link href="/about" className="px-4 py-2.5 hover:bg-paper-deep">
                About
              </Link>
              <a
                href="https://github.com/Gthoughts/pleasejudgemefairly"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 hover:bg-paper-deep"
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
