import Link from 'next/link'

// Small, quiet site footer. Used on the homepage and on the placeholder pages.
export default function SiteFooter() {
  return (
    <footer className="w-full border-t border-stone-200 py-6 text-sm text-stone-500">
      <nav className="mx-auto max-w-4xl flex flex-wrap items-center justify-center gap-x-6 gap-y-2 px-6">
        <Link href="/library" className="hover:text-stone-800">
          Library
        </Link>
        <Link href="/about" className="hover:text-stone-800">
          How This Works
        </Link>
        <a
          href="https://github.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-stone-800"
        >
          GitHub
        </a>
      </nav>
    </footer>
  )
}
