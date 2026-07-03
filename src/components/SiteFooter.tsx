import Link from 'next/link'

// Site-wide footer. Off the /accord routes the footer is deliberately
// nameless — the site is one part of a larger picture and doesn't want
// to carry a fixed brand. On /accord routes (RegionLanding), the Accord
// wordmark, tagline and URL are shown by passing showAccordMark.
export default function SiteFooter({
  region,
  showAccordMark = false,
}: {
  region?: string
  showAccordMark?: boolean
} = {}) {
  return (
    <footer className="border-t border-line py-10 text-center">
      {showAccordMark && (
        <>
          <div className="font-serif italic text-[1.05rem] text-ink">
            The {region ? `${region} ` : ''}Accord
          </div>
          <div className="text-[12.5px] text-ink-soft mt-2 tracking-[0.04em]">
            A DUTY WE SHARE · NOT A POWER WE SURRENDER
          </div>
          <div className="text-[12.5px] text-ink-soft mt-2 tracking-[0.04em]">
            TheAccord.cc{region ? `/${region}` : ''}
          </div>
        </>
      )}

      <nav
        aria-label="Footer"
        className={`${showAccordMark ? 'mt-6' : ''} flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12.5px] text-ink-soft`}
      >
        <Link href="/library" className="hover:text-ink hover:underline">
          Library
        </Link>
        <Link href="/about" className="hover:text-ink hover:underline">
          About
        </Link>
        <a
          href="https://github.com/Gthoughts/pleasejudgemefairly"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-ink hover:underline"
        >
          GitHub
        </a>
      </nav>
    </footer>
  )
}
