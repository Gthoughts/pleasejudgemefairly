import Image from 'next/image'
import Link from 'next/link'
import SubscribeForm from './SubscribeForm'
import SiteFooter from './SiteFooter'

// Server component. The Accord's landing page. The `region` prop is
// optional: with no region the page reads as the generic "The Accord"
// (TheAccord.cc); with a region passed in, it reads as e.g. "The
// Merseyside Accord" (TheAccord.cc/Merseyside). The component is
// shaped this way so a future regional page can reuse it without a
// rewrite.
//
// The only client-rendered part is the email form (SubscribeForm),
// which uses a server action to write to public.subscribers.
export default function RegionLanding({
  region,
}: {
  region?: string
}) {
  // All the per-region copy lives here so the JSX below stays clean.
  // When region is undefined, sentences fall back to generic wording.
  const copy = region
    ? {
        h1Region: ` ${region}`,
        urlSuffix: `/${region}`,
        openingSubject: `The people of ${region}`,
        techHereClause: <>, in {region}, </>,
        communityFutureSubject: `The community of ${region}`,
        beyondKicker: `Beyond ${region}`,
        beyondLeadIn: `This does not belong to ${region} alone.`,
      }
    : {
        h1Region: '',
        urlSuffix: '',
        openingSubject: 'The people',
        techHereClause: <> </>,
        communityFutureSubject: 'The community',
        beyondKicker: 'Wherever you are',
        beyondLeadIn: 'This does not belong to one place alone.',
      }

  return (
    <div className="paper-grain w-full">
      <div className="mx-auto max-w-[760px] px-8">
        {/* Small, quiet way back to the main site — this page is one
            part of a larger picture, not the whole site. */}
        <div className="pt-5">
          <Link
            href="/"
            className="text-[12px] tracking-[0.04em] text-ink-soft hover:text-ink underline underline-offset-4 decoration-dotted"
          >
            &larr; back to the main site
          </Link>
        </div>

        {/* ============== masthead ==============
            With no region the logo carries the title and the URL — the
            wordmark already reads "The Accord.cc" inside the artwork.
            With a region passed in (future regional pages) we fall back
            to a typographic H1 + animated river + URL line, so per-
            region wording still works without needing a logo per region.
        */}
        {region ? (
          <header className="pt-16">
            <div className="reveal d1 text-[12px] tracking-[0.32em] uppercase text-clay font-semibold">
              A community commitment
            </div>
            <h1 className="reveal d2 mt-3.5 font-serif font-medium text-[clamp(2.9rem,9vw,5.1rem)] leading-none tracking-[-0.015em]">
              The{copy.h1Region}{' '}
              <span className="italic font-normal text-ink-soft">Accord</span>
            </h1>
            <svg
              className="reveal d3 block w-full h-10 mt-[30px] overflow-visible"
              viewBox="0 0 700 40"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                className="river-path"
                d="M0,20 C70,4 130,36 200,20 C270,4 330,36 400,20 C470,4 530,36 600,20 C650,11 680,16 700,20"
              />
            </svg>
            <div className="reveal d4 mt-[22px] text-[13px] tracking-[0.16em] text-moss font-semibold">
              TheAccord.cc
              <span className="text-ink-soft">{copy.urlSuffix}</span>
            </div>
          </header>
        ) : (
          <header className="pt-12 text-center">
            <div className="reveal d1 text-[12px] tracking-[0.32em] uppercase text-clay font-semibold">
              A community commitment
            </div>
            <div className="reveal d2 mt-2">
              <Image
                src="/the-accord-logo.png"
                alt="The Accord — a community commitment"
                width={2000}
                height={2000}
                priority
                sizes="(max-width: 640px) 88vw, 480px"
                className="mx-auto w-[min(88vw,480px)] h-auto"
              />
            </div>
          </header>
        )}

        {/* ============== OPENING STATEMENT ============== */}
        <section className="py-14 pb-2">
          <div className="text-[12px] tracking-[0.28em] uppercase text-moss font-semibold mb-4">
            Our Opening Statement
          </div>

          <p className="font-serif font-medium text-[clamp(1.5rem,4vw,2.05rem)] leading-[1.22] tracking-[-0.01em] text-ink mb-[26px]">
            {copy.openingSubject} will no longer stand for being divided.
          </p>

          <p className="text-ink-soft mb-4 text-[16.5px] leading-[1.7]">
            We are exhausted with being told we are Far Right, or Far Left,
            or Centrist. We reject these labels. We are people first, a
            community of carers, hard workers, teachers, doctors, nurses,
            business owners, parents and neighbours. We are good, honest
            people, and we will no longer accept the state of our country
            or the institutions that have failed it.
          </p>

          <p className="text-ink font-semibold mb-4 text-[16.5px] leading-[1.7]">
            We will not accept sexual violence, child abuse, or violence of
            any kind in our community. The safety of every person, and above
            all every child, is the first duty we owe one another, and we
            place it before all else.
          </p>

          <p className="text-ink-soft mb-4 text-[16.5px] leading-[1.7]">
            We will no longer accept that our future should be decided by a
            narrow class of career politicians, drawn from privileged
            backgrounds, who do not know our lives and do not speak for us.
          </p>

          <p className="text-ink-soft mb-4 text-[16.5px] leading-[1.7]">
            We will not participate in foreign wars we have no connection to.
          </p>

          <p className="text-ink-soft mb-4 text-[16.5px] leading-[1.7]">
            We will no longer be held hostage by price-gouging industries, a
            “Rip-off Britain” that serves the few while working people carry
            the burden. We will no longer accept that a person can work more
            than forty hours a week and still be unable to afford the basics
            of a decent life: a home, food, warmth, and care.
          </p>

          <p className="text-ink-soft mb-4 text-[16.5px] leading-[1.7]">
            We will not stand by while the young adults of our community
            struggle to find work and a home of their own, only to be blamed
            for it by a wealthy, out-of-touch class that has never faced the
            same odds. Our young people are not feckless. They have been
            failed, and we will not let that failure be dressed up as their
            fault.
          </p>

          <p className="text-ink-soft mb-4 text-[16.5px] leading-[1.7]">
            We will not sit idle while artificial intelligence is used to
            discard working people, turning life into a scramble where only
            the quickest to adapt survive. AI is a tool, and we will use it
            as a tool should be used: to lift the whole community, not to
            enrich a few while the rest are cast aside. Technology that can
            do extraordinary things for people will{copy.techHereClause}be
            made to do them.
          </p>

          <p className="text-ink-soft mb-4 text-[16.5px] leading-[1.7]">
            We will no longer allow our rivers and our countryside to be
            polluted by failing private companies that line their pockets
            while neglecting the duties they were paid to uphold.
          </p>

          <p className="text-ink-soft mb-4 text-[16.5px] leading-[1.7]">
            We will no longer accept an underfunded health system that asks
            our sick to wait and our carers to break. We will not accept the
            quiet handover of our NHS and our social services, nor the access
            foreign corporations are granted to the personal data of our
            sick, our elderly, and our children. Our health is not a
            marketplace, and our data is not a commodity.
          </p>

          <p className="text-ink-soft mb-4 text-[16.5px] leading-[1.7]">
            We will no longer allow our children to be pigeon-holed by a
            one-size-fits-all education system that mistakes uniformity for
            learning.
          </p>

          <p className="text-ink-soft mb-4 text-[16.5px] leading-[1.7]">
            We refuse government overreach into our personal choices. We
            will make our own decisions, as informed adults, based on facts
            and honest research, including which plants and natural
            substances we choose to permit in our own community. And we
            will not allow genuinely dangerous substances to take root among
            us: substances that damage lives, break families, and feed the
            cycle of crime.
          </p>

          <p className="text-ink-soft mb-4 text-[16.5px] leading-[1.7]">
            We demand genuine freedom of speech, and the right of every
            person to practise their religion and culture freely, on the one
            condition that binds us all equally: that no belief, religious
            or ideological, is ever forced upon another, nor used to harm,
            coerce or deny the freedoms of anyone else. Every member of our
            community is free to make their own choices.
          </p>

          <p className="text-ink-soft mb-4 text-[16.5px] leading-[1.7]">
            We will no longer allow any voice to be silenced. Every voice
            will be heard equally, and hierarchy will give way to community.
          </p>

          <p className="text-ink-soft mb-4 text-[16.5px] leading-[1.7]">
            We will no longer accept outrage selected for us by media
            coverage, nor division manufactured to keep us apart.
          </p>

          <p className="text-ink font-semibold mb-4 text-[16.5px] leading-[1.7]">
            {copy.communityFutureSubject} will decide its own future and its
            own direction.
          </p>
          <p className="text-ink font-semibold mb-4 text-[16.5px] leading-[1.7]">
            Governance will be a duty we share, not a power we surrender.
          </p>

          <p className="font-serif italic font-normal text-[1.5rem] text-ink mt-[26px]">
            This is our Accord.
          </p>
        </section>

        <hr className="h-px bg-line border-0" />

        {/* ============== Manifesto coming ============== */}
        <div className="bg-white border border-line p-[40px_34px] my-1">
          <p className="reveal d4 font-serif font-normal italic text-[clamp(1.6rem,4.6vw,2.3rem)] text-ink leading-[1.25]">
            The Manifesto is{' '}
            <b className="not-italic font-semibold">coming soon.</b>
          </p>
          <div className="reveal d4 mt-[30px] border-l-2 border-clay py-1 pl-[22px] text-ink-soft text-[16.5px]">
            Every word of the Manifesto will be put to a vote, decided by{' '}
            <strong className="text-ink font-semibold">
              each individual in the community
            </strong>
            . Nothing is imposed from above. We decide together what goes
            in, and what does not.
          </div>
        </div>

        <hr className="h-px bg-line border-0" />

        {/* ============== GET INVOLVED ============== */}
        <section className="py-14">
          <div className="text-[12px] tracking-[0.28em] uppercase text-moss font-semibold mb-4">
            Get Involved
          </div>
          <h2 className="font-serif font-medium text-[clamp(1.9rem,5vw,2.6rem)] leading-[1.12] tracking-[-0.01em] mb-[18px]">
            We need every pair of hands we can find.
          </h2>
          <p className="text-ink-soft mb-3.5 leading-[1.7]">
            If you believe you have nothing to offer, you are mistaken.{' '}
            <strong className="text-ink font-semibold">
              Everyone has skills.
            </strong>{' '}
            Society has simply taught too many people that theirs do not
            count, and that is not true.
          </p>
          <p className="text-ink-soft mb-3.5 leading-[1.7]">
            Whatever you can give, whether time, a trade, an idea, knowledge,
            a cooked meal, a spare room, a willing pair of hands, or an hour
            a week, there is a place for it here. A community is built by
            the many, not the few.
          </p>
          <p className="text-ink-soft leading-[1.7]">
            And if you can do nothing else today, simply share this page.
            Pass it to a neighbour, a friend, a relative. Every person who
            hears of the Accord is one more step toward a community that
            looks after its own. It all helps.
          </p>

          <div className="bg-paper-deep border border-line p-[38px_34px] mt-8">
            <h3 className="font-serif font-medium text-[1.5rem] mb-2">
              Add your name.
            </h3>
            <p className="text-ink-soft text-[15.5px] mb-[22px]">
              Leave your email and we’ll let you know how to take part, and
              when the Manifesto opens for its first vote.
            </p>
            <SubscribeForm region={region ?? null} />
          </div>
        </section>

        <hr className="h-px bg-line border-0" />

        {/* ============== OTHER COUNTIES / wherever you are ============== */}
        <section className="py-14">
          <div className="text-[12px] tracking-[0.28em] uppercase text-moss font-semibold mb-4">
            {copy.beyondKicker}
          </div>
          <h2 className="font-serif font-medium text-[clamp(1.9rem,5vw,2.6rem)] leading-[1.12] tracking-[-0.01em] mb-[18px]">
            People first. Hierarchy last.
          </h2>
          <p className="text-ink-soft mb-3.5 leading-[1.7]">
            {copy.beyondLeadIn} We will work alongside{' '}
            <strong className="text-ink font-semibold">
              any community
            </strong>{' '}
            that chooses to put its people first and its hierarchy last.
          </p>
          <p className="text-ink-soft leading-[1.7]">
            If you want to begin organising where you live, tell us. Use the
            sign-up above and tell us where you’re from. We will help you
            start, and we will share what we learn as we go.
          </p>
        </section>

        <hr className="h-px bg-line border-0" />

        {/* Second, more explicit way back to the main site. */}
        <section className="py-10 text-center">
          <Link
            href="/"
            className="text-[13px] text-ink-soft hover:text-ink underline underline-offset-4"
          >
            Return to the main site
          </Link>
        </section>
      </div>

      <SiteFooter region={region} />
    </div>
  )
}
