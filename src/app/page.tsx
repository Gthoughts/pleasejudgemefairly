import Link from 'next/link'
import SiteFooter from '@/components/SiteFooter'

// Homepage: one YouTube video (privacy-enhanced domain), a warm welcome
// line, a quiet link into the discussion, and a small dedication. No nav,
// no popups, no cookie banner.
// Sasquatch Music Festival 2009 "first follower" clip.
const HOMEPAGE_VIDEO_ID = 'GA8z7f7a2Pk'

export default function HomePage() {
  return (
    <>
      <main className="flex-1 flex flex-col items-center px-6 pt-16 pb-20">
        {/* Video */}
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

        {/* Welcome line - the warmest thing on the page, given room to breathe. */}
        <p className="mt-20 text-center text-lg sm:text-xl text-stone-800 font-normal">
          You found us. We&rsquo;re so glad you did.
        </p>

        {/* Quiet link into the discussion. */}
        <Link
          href="/discuss"
          className="mt-10 text-sm text-stone-500 hover:text-stone-800 hover:underline underline-offset-4"
        >
          join the conversation &rarr;
        </Link>

        {/*
          Dedication.

          The attribution uses a native <details>/<summary> so it stays
          keyboard-accessible and screen-reader friendly without any
          JavaScript. The subtle dotted underline on the summary is a
          quiet hint that there is more to read, without shouting.
        */}
        <section
          aria-label="Dedication"
          className="mt-32 flex flex-col items-center"
        >
          <p className="text-center text-sm italic text-stone-500">
            &ldquo;please judge me fairly&rdquo;
          </p>
          <details className="mt-2 text-center">
            <summary
              className="list-none cursor-pointer text-sm text-stone-400 underline decoration-dotted decoration-stone-300 underline-offset-4 hover:text-stone-600 hover:decoration-stone-500 focus-visible:outline-none focus-visible:text-stone-700 [&::-webkit-details-marker]:hidden"
              aria-label="Errol Graham, 1961 to 2018. Click to read about him."
            >
              &mdash; Errol Graham, 1961&ndash;2018
            </summary>
            <p className="mx-auto mt-5 max-w-md px-4 text-xs leading-relaxed text-stone-500">
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
