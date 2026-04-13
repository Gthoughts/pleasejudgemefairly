import Link from 'next/link'

// Top header for the homepage. Quiet site-name on the left,
// core nav links on the right.
export default function SiteHeader() {
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
          <Link href="/about" className="hover:underline">
            How This Works
          </Link>
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
      </div>
    </header>
  )
}
