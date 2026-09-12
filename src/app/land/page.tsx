import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'
import LandMap from './LandMap'

export const metadata = {
  title: 'Land — a place for you',
  description:
    'An honest, plain-English guide to adverse possession in the UK: what it really takes to claim unregistered or neglected land, the real forms and costs, and the risks.',
}

export default function LandPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1 px-4 sm:px-6 py-10 sm:py-16">
        <article className="mx-auto max-w-2xl">
          <h1 className="text-3xl font-semibold text-stone-900">Land</h1>
          <p className="mt-4 text-stone-700 text-base leading-relaxed">
            There is a real, legal route by which someone can end up owning
            land they never bought. It is called <strong>adverse
            possession</strong>. It is genuine — but it is slow, uncertain, and
            widely misunderstood. This page explains it honestly: what it
            actually takes, the real forms and costs, and the parts most people
            get wrong. Read the whole thing before you act on any of it.
          </p>

          {/* Honest reality banner */}
          <div className="mt-6 rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-medium">Read this first.</p>
            <p className="mt-1">
              Almost all land in the UK is owned by someone — a person, a
              company, a council, or the Crown. &ldquo;Unregistered&rdquo; does
              not mean &ldquo;unowned&rdquo;. There is no public list of free
              land to grab, and occupying land you have no right to can be
              trespass. This is a long legal process with a real chance of
              failure, not a shortcut to a free plot. For any specific claim,
              get proper legal advice.
            </p>
          </div>

          {/* 1. What it is */}
          <section className="mt-12">
            <h2 className="text-xl font-semibold text-stone-900">
              What adverse possession is
            </h2>
            <div className="mt-4 space-y-4 text-stone-700 text-base leading-relaxed">
              <p>
                If you occupy land as though it were your own — openly,
                exclusively, without the owner&rsquo;s permission — for long
                enough, the law may let you apply to be registered as its
                owner. You have to prove all of the following, continuously,
                for the whole period:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>Factual possession</strong> — you physically control
                  the land (e.g. you have fenced it, maintained it, used it).
                </li>
                <li>
                  <strong>Intention to possess</strong> — you mean to hold it
                  as your own, shown by what you actually do on it.
                </li>
                <li>
                  <strong>Open and obvious</strong> — your use is visible to
                  anyone, including the owner. Secret use does not count.
                </li>
                <li>
                  <strong>Exclusive</strong> — you exclude others, the true
                  owner included.
                </li>
                <li>
                  <strong>Without consent</strong> — if the owner gave you
                  permission, the clock never starts (or stops the moment they
                  do).
                </li>
              </ul>
            </div>
          </section>

          {/* 2. How long */}
          <section className="mt-12">
            <h2 className="text-xl font-semibold text-stone-900">
              How long it takes
            </h2>
            <div className="mt-4 space-y-4 text-stone-700 text-base leading-relaxed">
              <p>
                The period depends on whether the land is already registered at
                HM Land Registry:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>Registered land — 10 years.</strong> Under the Land
                  Registration Act 2002 you can apply after 10 years&rsquo;
                  adverse possession. But see the catch below — this is the hard
                  case.
                </li>
                <li>
                  <strong>Unregistered land — 12 years.</strong> Under the
                  Limitation Act 1980, after 12 years the previous owner&rsquo;s
                  right to evict you is generally extinguished, and you can
                  apply for first registration.
                </li>
                <li>
                  <strong>Crown foreshore — 60 years.</strong> Special, much
                  longer rules apply to Crown land such as the foreshore.
                </li>
              </ul>
            </div>
          </section>

          {/* 3. The catch */}
          <section className="mt-12">
            <h2 className="text-xl font-semibold text-stone-900">
              The catch most guides leave out
            </h2>
            <div className="mt-4 space-y-4 text-stone-700 text-base leading-relaxed">
              <p>
                For <strong>registered</strong> land, reaching 10 years does
                not mean the land is yours. When you apply, HM Land Registry
                <strong> notifies the registered owner</strong>. They then have
                a window (65 working days) to object. If they object, your
                application is normally <strong>rejected</strong> — and you only
                get a further chance if you stay in possession another two years
                and they still take no steps to remove you. In practice, a
                paying-attention owner can defeat a registered-land claim simply
                by responding. This is deliberate: the law was changed in 2002
                specifically to make taking registered land hard.
              </p>
              <p>
                This is why genuine adverse possession usually involves small
                strips of <em>unregistered</em> land, or boundary land that has
                been used for decades — not &ldquo;claiming a field&rdquo;.
              </p>
            </div>
          </section>

          {/* 4. Researching a plot — real tools + map */}
          <section className="mt-12">
            <h2 className="text-xl font-semibold text-stone-900">
              Researching a plot
            </h2>
            <div className="mt-4 space-y-4 text-stone-700 text-base leading-relaxed">
              <p>
                There is <strong>no database of unowned land</strong>. Finding a
                genuine candidate is legwork, not a search query. The tools
                below are the real, free ones — they help you explore land and
                check ownership, but none of them hands you a list of free
                plots.
              </p>
            </div>

            {/* Interactive OS / OpenStreetMap map */}
            <div className="mt-6">
              <LandMap />
            </div>

            <div className="mt-6 space-y-4 text-stone-700 text-base leading-relaxed">
              <ul className="list-disc pl-5 space-y-3">
                <li>
                  <strong>Check who owns it.</strong> HM Land Registry&rsquo;s{' '}
                  <a
                    href="https://www.gov.uk/search-property-information-land-registry"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-stone-900"
                  >
                    Search for land and property information
                  </a>{' '}
                  service lets you buy the title register and plan for a small
                  fee (a few pounds). This tells you if the land is registered
                  and who owns it. If a search returns nothing, the land may be
                  unregistered.
                </li>
                <li>
                  <strong>Explore the map data.</strong>{' '}
                  <a
                    href="https://overpass-turbo.eu/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-stone-900"
                  >
                    Overpass Turbo
                  </a>{' '}
                  is a free tool for querying OpenStreetMap data (land use,
                  boundaries, features) in an area — no account needed. Useful
                  for understanding an area, though it will not tell you who owns
                  anything.
                </li>
                <li>
                  <strong>Ordnance Survey data.</strong> The{' '}
                  <a
                    href="https://osdatahub.os.uk/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-stone-900"
                  >
                    OS Data Hub
                  </a>{' '}
                  offers free OpenData with detailed UK mapping and parcel
                  outlines.
                </li>
                <li>
                  <strong>Planning history.</strong> Your local council&rsquo;s
                  planning portal (find it via the{' '}
                  <a
                    href="https://www.planningportal.co.uk/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-stone-900"
                  >
                    Planning Portal
                  </a>
                  ) shows applications and enforcement notices, which can hint
                  at neglected or disputed land.
                </li>
                <li>
                  <strong>Visit it.</strong> Photograph it, note the location,
                  and look for rights of way, easements or signs of the
                  owner&rsquo;s use before you do anything.
                </li>
              </ul>
            </div>
          </section>

          {/* 5. The real forms */}
          <section className="mt-12">
            <h2 className="text-xl font-semibold text-stone-900">
              The real forms and process
            </h2>
            <div className="mt-4 space-y-4 text-stone-700 text-base leading-relaxed">
              <p>
                These are the actual HM Land Registry forms — the correct ones,
                confirmed on GOV.UK:
              </p>
              <ul className="list-disc pl-5 space-y-3">
                <li>
                  <strong>Form ADV1</strong> — the application to be registered
                  as proprietor by adverse possession (registered land).{' '}
                  <a
                    href="https://www.gov.uk/government/publications/adverse-possession-registration-adv1"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-stone-900"
                  >
                    ADV1 on GOV.UK
                  </a>
                </li>
                <li>
                  <strong>Form ST1</strong> — the statement of truth setting out
                  the evidence for your claim, which goes with ADV1.{' '}
                  <a
                    href="https://www.gov.uk/government/publications/adverse-possession-statement-of-truth-st1"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-stone-900"
                  >
                    ST1 on GOV.UK
                  </a>
                </li>
                <li>
                  <strong>A plan</strong> identifying the exact land, and your
                  supporting evidence (photos, dated records, anything showing
                  continuous use).
                </li>
              </ul>
              <p>
                The authoritative rules are in HM Land Registry&rsquo;s{' '}
                <a
                  href="https://www.gov.uk/government/publications/adverse-possession-of-registered-land/practice-guide-4-adverse-possession-of-registered-land"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-stone-900"
                >
                  Practice Guide 4 (adverse possession of registered land)
                </a>{' '}
                and{' '}
                <a
                  href="https://www.gov.uk/government/publications/statements-of-truth/practice-guide-73-statements-of-truth"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-stone-900"
                >
                  Practice Guide 73 (statements of truth)
                </a>
                . Application fees are listed on the{' '}
                <a
                  href="https://www.gov.uk/guidance/hm-land-registry-registration-services-fees"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-stone-900"
                >
                  HM Land Registry fees page
                </a>{' '}
                — check the current figure there rather than trusting a number
                quoted elsewhere.
              </p>
            </div>
          </section>

          {/* 6. Honest closing */}
          <section className="mt-12">
            <h2 className="text-xl font-semibold text-stone-900">
              Being honest about it
            </h2>
            <div className="mt-4 space-y-4 text-stone-700 text-base leading-relaxed">
              <p>
                Adverse possession is real, but it is not a life hack for free
                land. Most attempts on registered land fail because the owner
                objects. It takes many years of genuine, provable, exclusive
                use. Occupying land you have no claim to can expose you to legal
                action. And the sources that promise a quick scan for
                &ldquo;unclaimed&rdquo; parcels are, bluntly, selling something
                that does not exist.
              </p>
              <p>
                If you have land you have genuinely used for years — a boundary
                strip, a scrap of ground next to your home — and you think you
                may have a real claim, the honest next step is to read Practice
                Guide 4 in full and speak to a solicitor before spending money
                or making a move.
              </p>
              <p className="text-sm text-stone-500">
                This page is general information, not legal advice. Land law is
                specific to each case. Always confirm the current rules, forms
                and fees on GOV.UK and take professional advice for a real
                claim.
              </p>
            </div>
          </section>
        </article>
      </main>
      <SiteFooter />
    </>
  )
}
