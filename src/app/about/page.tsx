import SiteFooter from '@/components/SiteFooter'
import Link from 'next/link'

export const metadata = {
  title: 'How This Works — pleasejudgemefairly',
}

export default function AboutPage() {
  return (
    <>
      <main className="flex-1 px-6 py-16">
        <article className="mx-auto max-w-2xl">

          <h1 className="text-3xl font-semibold text-stone-900">
            How this works
          </h1>

          <div className="mt-6 space-y-4 text-stone-700 text-base leading-relaxed">
            <p>
              This is a place to come together because we&rsquo;ve had enough. A
              place to come up with solutions, not to point out what can&rsquo;t
              be done.
            </p>
            <p>
              We&rsquo;ve got a couple of rules and they&rsquo;re simple.
            </p>
            <p>
              No selling. No spamming. No soliciting of any kind. That will get
              you banned, because you&rsquo;re here for the same reason everyone
              else is and it isn&rsquo;t that.
            </p>
            <p>
              Remember you&rsquo;re here because you want something better. If
              you don&rsquo;t agree with someone, that&rsquo;s normal. Discuss
              it. Don&rsquo;t bicker. Arguing helps no one.
            </p>
            <p>
              Treat everyone with respect.
            </p>
          </div>

          <section className="mt-12">
            <h2 className="text-xl font-semibold text-stone-900">
              What this site is
            </h2>
            <div className="mt-4 space-y-4 text-stone-700 text-base leading-relaxed">
              <p>
                A seed, not a finished product. I don&rsquo;t know exactly what
                this will become and I don&rsquo;t want to. The whole point is
                that it grows into whatever the people who show up decide it
                needs to be. What you see today is the starting point. The
                foundations are in place, the rules are clear, and the rest is
                up to all of us.
              </p>
              <p>
                If an idea makes the site better, we&rsquo;ll talk about it and
                we&rsquo;ll add it. If something isn&rsquo;t working,
                we&rsquo;ll fix it. If something is broken we haven&rsquo;t
                noticed, tell us. This is open source, which means the code that
                runs this site is public and anyone can contribute changes
                through GitHub. You don&rsquo;t have to be a coder, suggestions
                are just as valuable.
              </p>
            </div>
          </section>

          <section className="mt-12">
            <h2 className="text-xl font-semibold text-stone-900">
              What this site isn&rsquo;t
            </h2>
            <div className="mt-4 space-y-4 text-stone-700 text-base leading-relaxed">
              <p>
                It isn&rsquo;t a platform for personal brands. It isn&rsquo;t a
                place to build followers or chase attention. There are no likes,
                no karma scores, no leaderboards, no profile photos, no follower
                counts. Just people writing things and other people reading them.
                That&rsquo;s on purpose.
              </p>
              <p>
                It isn&rsquo;t a business. Nobody is making money from this site
                and nobody ever will. No adverts, no sponsorships, no paid
                tiers, no premium features. The domain, the hosting and the few
                pounds it costs to keep running come out of my pocket until the
                community is big enough to share the load.
              </p>
              <p>
                There are a couple of people here to help with the site.
                You&rsquo;ll see them posting as &ldquo;site admin&rdquo;. They
                have no more power than anyone else. I&rsquo;ll be on here too
                with a username like everyone else.
              </p>
            </div>
          </section>

          <section className="mt-12">
            <h2 className="text-xl font-semibold text-stone-900">
              Add to it
            </h2>
            <div className="mt-4 space-y-4 text-stone-700 text-base leading-relaxed">
              <p>
                This site is only as good as what people bring to it. Share your
                discoveries. Add resources to the library. Tell us about the
                books, documentaries, articles and archives that opened your
                eyes. Point us at the best places to learn.
              </p>
              <p>
                Tell us about the messengers whose stories deserve to be heard.
                There are people throughout history who said the right things at
                the right time and got buried for it, and there are people doing
                the same thing right now. Bring them into the light.
              </p>
              <p>
                One thing though. Stick to verifiable facts. Don&rsquo;t wander
                too far into conspiracy. The strength of everything here depends
                on it being true, and once you start mixing solid history with
                speculation, the solid history loses its weight. If something is
                your interpretation, say so. If something is contested, say so.
                Honesty is what makes this different from the noise everywhere
                else.
              </p>
            </div>
          </section>

          <section className="mt-12">
            <h2 className="text-xl font-semibold text-stone-900">
              Moderation
            </h2>
            <div className="mt-4 space-y-4 text-stone-700 text-base leading-relaxed">
              <p>
                There are no moderators and there is no hidden admin power to
                silence people.
              </p>
              <p>
                The site polices itself through a rating system designed to
                resist groupthink and brigading. If a post gets marked as
                unhelpful by a diverse range of people, it gets quietly
                collapsed &mdash; not deleted, just hidden behind a &ldquo;show
                this post&rdquo; link that anyone can click. If a few people
                from the same faction try to gang up on a post they disagree
                with, the system notices and their votes count for less. You can
                also mute or block individual users from your own view without
                affecting anyone else.
              </p>
              <p>
                An automatic filter catches obvious spam and soliciting at the
                point of posting. If you trip it by accident your post is held
                briefly for review, not deleted, and the community can release
                it.
              </p>
              <p>
                If someone turns up with bad intentions, it will be clear to
                everyone and very easy to block. That&rsquo;s the whole point of
                building it this way.
              </p>
            </div>
          </section>

          <section className="mt-12">
            <h2 className="text-xl font-semibold text-stone-900">
              What happens next
            </h2>
            <div className="mt-4 space-y-4 text-stone-700 text-base leading-relaxed">
              <p>
                The first version of this site has the basics. Discussion areas,
                a library where anyone can submit resources, the book, and the
                foundations we need to grow. Over time, if people want them, we
                can add local meetup tools, translation support for the book,
                practical knowledge sharing, whatever the community decides it
                needs. I&rsquo;m not going to decide in advance because I
                don&rsquo;t know.
              </p>
              <p>
                What I do know is that if we can&rsquo;t organise a website,
                we&rsquo;ll struggle with a society. So let&rsquo;s start small,
                get this right, and see where it goes.
              </p>
              <p>
                Welcome. I&rsquo;m glad you&rsquo;re here.
              </p>
            </div>
          </section>

          <p className="mt-16">
            <Link
              href="/"
              className="text-sm text-stone-500 underline underline-offset-4 hover:text-stone-900"
            >
              ← back home
            </Link>
          </p>

        </article>
      </main>
      <SiteFooter />
    </>
  )
}
