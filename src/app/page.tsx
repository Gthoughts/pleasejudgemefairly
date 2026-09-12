import Link from 'next/link'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'

// Homepage: a full-screen background image with the content layered on top —
// a small "It only takes One" line, a quiet link into the discussion, an
// install box, and a small dedication. No nav clutter, no popups, no cookie
// banner.

export default function HomePage() {
  return (
    <div className="relative min-h-screen flex flex-col">
      {/* Full-screen background image */}
      <div
        aria-hidden
        className="fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/home/it-only-takes-one.png')" }}
      />
      {/* Soft scrim so overlaid text stays readable (adjust/remove to taste) */}
      <div aria-hidden className="fixed inset-0 -z-10 bg-white/55" />

      <SiteHeader />
      <main className="flex-1 flex flex-col items-center px-6 pt-16 pb-20">
        <p className="mb-4 self-start text-left text-sm text-stone-700 tracking-wide">
          It only takes One
        </p>

        <p className="mt-16 text-center text-lg sm:text-xl text-stone-900 font-medium drop-shadow-sm">
          You found us. We&rsquo;re so glad you did.
        </p>

        <Link
          href="/discuss"
          className="mt-10 text-sm text-stone-800 hover:text-stone-950 hover:underline underline-offset-4 font-medium"
        >
          join the conversation &rarr;
        </Link>

        <section
          aria-label="Install to home screen"
          className="mt-16 w-full max-w-2xl"
        >
          <details className="rounded border border-stone-200 bg-white/70 backdrop-blur-sm">
            <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer px-5 py-4 text-sm font-medium text-stone-700 hover:text-stone-900 select-none flex items-center justify-between">
              <span>Add this to your phone&rsquo;s home screen</span>
              <span
                aria-hidden
                className="text-stone-400 group-open:rotate-180 transition-transform"
              >
                ▾
              </span>
            </summary>
            <div className="border-t border-stone-200 grid gap-6 px-5 py-5 sm:grid-cols-2 text-sm text-stone-700">
              <div>
                <h3 className="font-medium text-stone-900">On iPhone / iPad</h3>
                <ol className="mt-2 flex flex-col gap-1.5 list-decimal pl-5 text-stone-700">
                  <li>Open this page in Safari.</li>
                  <li>
                    Tap the <strong>Share</strong> icon (a square with an
                    arrow pointing up) at the bottom of the screen.
                  </li>
                  <li>
                    Scroll down and tap{' '}
                    <strong>Add to Home Screen</strong>.
                  </li>
                  <li>
                    Tap <strong>Add</strong> in the top-right corner.
                  </li>
                </ol>
                <p className="mt-2 text-xs text-stone-500">
                  The icon will appear on your home screen. Opening it
                  from there gives you the site full-screen, like a
                  proper app.
                </p>
              </div>

              <div>
                <h3 className="font-medium text-stone-900">On Android</h3>
                <ol className="mt-2 flex flex-col gap-1.5 list-decimal pl-5 text-stone-700">
                  <li>Open this page in Chrome.</li>
                  <li>
                    Tap the <strong>three dots</strong> menu in the
                    top-right.
                  </li>
                  <li>
                    Tap <strong>Install app</strong> (or{' '}
                    <strong>Add to Home screen</strong> on some phones).
                  </li>
                  <li>Follow the prompt and confirm.</li>
                </ol>
                <p className="mt-2 text-xs text-stone-500">
                  The icon will appear on your home screen. Opening it
                  from there gives you the site full-screen, like a
                  proper app.
                </p>
              </div>
            </div>
          </details>
        </section>

        <section
          aria-label="Dedication"
          className="mt-24 flex flex-col items-center"
        >
          <p className="text-center text-sm italic text-stone-600">
            &ldquo;please judge me fairly&rdquo;
          </p>
          <details className="mt-2 text-center">
            <summary
              className="list-none cursor-pointer text-sm text-stone-600 underline decoration-dotted decoration-stone-500 underline-offset-4 hover:text-stone-800 hover:decoration-stone-700 focus-visible:outline-none focus-visible:text-stone-800 [&::-webkit-details-marker]:hidden"
              aria-label="Errol Graham, 1961 to 2018. Click to read about him."
            >
              &mdash; Errol Graham, 1961&ndash;2018
            </summary>
            <p className="mx-auto mt-5 max-w-md px-4 text-sm leading-relaxed text-stone-700 bg-white/60 rounded py-3">
              Errol Graham died in 2018 after his benefits were stopped.
              He weighed four and a half stone when he was found. The
              phrase was in an unsent letter to the DWP.
            </p>
          </details>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
