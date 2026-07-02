import Link from 'next/link'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'

// Homepage: one YouTube video (privacy-enhanced domain), a warm welcome
// line, a quiet link into the discussion, a small clickable box that
// leads to The Accord, and a small dedication. No nav clutter, no
// popups, no cookie banner.
//
// Sasquatch Music Festival 2009 "first follower" clip.
const HOMEPAGE_VIDEO_ID = 'GA8z7f7a2Pk'

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1 flex flex-col items-center px-6 pt-16 pb-20">
        <p className="mb-8 max-w-2xl text-center italic text-stone-600 text-base sm:text-lg leading-relaxed">
          It only takes one to get up and dance and two to join.
        </p>

        <div className="w-full max-w-4xl">
          <div className="relative w-full aspect-video rounded-lg overflow-hidden shadow-sm ring-1 ring-stone-200 bg-black">
            <iframe
              className="absolute inset-0 h-full w-full"
              src={`https://www.youtube-nocookie.com/embed/${HOMEPAGE_VIDEO_ID}?rel=0&modestbranding=1`}
              title="Homepage video"
              loading="lazy"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>

        <p className="mt-20 text-center text-lg sm:text-xl text-stone-800 font-normal">
          You found us. We&rsquo;re so glad you did.
        </p>

        <Link
          href="/discuss"
          className="mt-10 text-sm text-stone-600 hover:text-stone-900 hover:underline underline-offset-4"
        >
          join the conversation &rarr;
        </Link>

        <Link
          href="/accord"
          aria-label="Read The Accord — a community commitment"
          className="mt-14 group inline-flex flex-col items-center gap-1.5 rounded-md border border-stone-200 bg-white/60 px-7 py-4 text-center transition-colors hover:border-stone-400 hover:bg-white"
        >
          <span className="text-[10px] uppercase tracking-[0.28em] text-stone-500 group-hover:text-stone-700">
            A community commitment
          </span>
          <span className="font-serif italic text-base text-stone-700 group-hover:text-stone-900">
            The Accord
          </span>
        </Link>

        <section
          aria-label="Dedication"
          className="mt-24 flex flex-col items-center"
        >
          <p className="text-center text-sm italic text-stone-500">
            &ldquo;please judge me fairly&rdquo;
          </p>
          <details className="mt-2 text-center">
            <summary
              className="list-none cursor-pointer text-sm text-stone-500 underline decoration-dotted decoration-stone-400 underline-offset-4 hover:text-stone-700 hover:decoration-stone-600 focus-visible:outline-none focus-visible:text-stone-700 [&::-webkit-details-marker]:hidden"
              aria-label="Errol Graham, 1961 to 2018. Click to read about him."
            >
              &mdash; Errol Graham, 1961&ndash;2018
            </summary>
            <p className="mx-auto mt-5 max-w-md px-4 text-sm leading-relaxed text-stone-600">
              Errol Graham died in 2018 after his benefits were stopped.
              He weighed four and a half stone when he was found. The
              phrase was in an unsent letter to the DWP.
            </p>
          </details>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
