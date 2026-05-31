import Link from 'next/link'

// Site-wide footer for The Accord. Shows the mark, the tagline, the
// regional URL, and a quiet row of the existing site links so anyone
// who wants to drop straight into the wider platform can.
//
// region is optional — only the homepage passes it (to render
// "TheAccord.cc/Merseyside"). Other pages get the plain mark.
export default function SiteFooter({ region }: { region?: string } = {}) {
  return (
    <footer className="border-t border-line py-10 text-center">
      <div className="font-serif italic text-[1.05rem] text-ink">
        The {region ? `${region} ` : ''}Accord
      </div>
      <div className="text-[12.5px] text-ink-soft mt-2 tracking-[0.04em]">
        A DUTY WE SHARE · NOT A POWER WE SURRENDER
      </div>
      <div className="text-[12.5px] text-ink-soft mt-2 tracking-[0.04em]">
        TheAccord.cc{region ? `/${region}` : ''}
      </div>

      <nav
        aria-label="Footer"
        className="mt-6 flex items-center justify-center gap-6 text-[12.5px] text-ink-soft"
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
