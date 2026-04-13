# pleasejudgemefairly

A quiet corner of the internet for honest conversation and shared learning.
Not a movement, not a brand, not a business. A seed that can evolve into
whatever the community decides it needs to be.

## The one rule

Nobody makes money from this site. No advertising, no sponsorships, no
affiliate links, no soliciting, no "buy my thing". Anyone trying to monetise
the platform or its users gets permanently banned.

## Status

This repo is through **Phase 3** of the build plan. In place:

- **Phase 1** — Next.js 16 foundation, Supabase Auth with email
  verification, homepage with a YouTube embed, database schema with
  Row Level Security.
- **Phase 2** — Discussion area (`/discuss`), threaded replies up to
  5 levels deep, per-post edit/delete/mute/block, a plain inbox at
  `/inbox`, and blocks enforced at the database layer.
- **Phase 3** — Cross-perspective rating system (1-dimensional matrix
  factorisation inspired by Community Notes), automatic content
  filter for spam and solicitation, held-post queue at `/review`,
  and a scheduled job at `/api/cron/ratings` that recomputes scores
  and releases expired holds. See [`docs/RATING_SYSTEM.md`](./docs/RATING_SYSTEM.md)
  for the algorithm explainer, its limitations, and what it can and
  cannot be used for.

The library is **not built yet** (Phase 4). See the build
specification for what is coming next.

### Admin role

There is exactly one kind of elevated permission in this project: a
comma-separated list of email addresses in the `ADMIN_EMAIL`
environment variable. Admins can release posts from the held-for-
review queue early. They cannot delete content, edit other users'
posts, or override rating decisions. The long-term plan is to hand
this role to a rotating group elected by contributors once the site
reaches 1,000 active users.

The current admin contact will be published here when the site goes
live.

## Licence

This project is released under the **GNU Affero General Public License
v3.0** (AGPL v3). In plain terms:

- Anyone is free to use, study, modify, and share the code.
- If you run a modified version as a public service, you must make your
  modified source code available to the users of that service under the same
  licence.

The full licence text is in [`LICENSE`](./LICENSE).

## Running locally

### Prerequisites

- Node.js **20.9+** (Next.js 16 requirement)
- npm (ships with Node)
- A free [Supabase](https://supabase.com) project

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the example file and fill in your Supabase project values:

```bash
cp .env.example .env.local
```

`.env.local` is gitignored. You only need the public (`anon`) key for local
development:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

You can find both values under **Project Settings → API** in the Supabase
dashboard.

### 3. Apply the database schema

Run the migrations in order in the Supabase SQL editor:

1. [`supabase/schema.sql`](./supabase/schema.sql) — creates the
   `users`, `threads`, `posts`, `resources`, `ratings`, `mutes`,
   `blocks`, and `flags` tables, enables RLS, and installs auth
   sync triggers.
2. [`supabase/phase2_migration.sql`](./supabase/phase2_migration.sql)
   — adds the block-prevention policy on post inserts and the
   `is_blocked_by` RPC.
3. [`supabase/phase3_migration.sql`](./supabase/phase3_migration.sql)
   — adds rating/hold columns to `posts`, the `collapse_log` audit
   table, and tightens the `ratings` read policy to "own only".

### 4. Turn on email verification

In the Supabase dashboard, go to **Authentication → Providers → Email** and
make sure **Confirm email** is enabled. New accounts will receive a
verification link before they can sign in.

### 5. Start the dev server

```bash
npm run dev
```

Open <http://localhost:3000>.

## Deploying to Vercel

1. Push the repo to GitHub.
2. Import the project into [Vercel](https://vercel.com/new).
3. In the project settings, add these environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_URL` (your production domain)
   - `SUPABASE_SERVICE_ROLE_KEY` — from Supabase project settings,
     used only by the cron endpoint
   - `CRON_SECRET` — a long random string; Vercel Cron will send it
     in the `Authorization` header on every scheduled run
   - `ADMIN_EMAIL` — comma-separated admin emails
4. Deploy. Vercel will detect Next.js automatically and schedule the
   cron job (`/api/cron/ratings` every 15 minutes) from
   [`vercel.json`](./vercel.json).

### Running the cron job manually (local testing)

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
     http://localhost:3000/api/cron/ratings
```

### Brigading test

```bash
npm run test:brigading
```

Runs four scenarios against the real matrix factorisation and
verifies the brigading defences hold. See
[`scripts/test-brigading.ts`](./scripts/test-brigading.ts) and
[`docs/RATING_SYSTEM.md`](./docs/RATING_SYSTEM.md) for details.

## Project layout

```
pleasejudgemefairly/
├── src/
│   ├── app/
│   │   ├── layout.tsx                    # Root layout
│   │   ├── page.tsx                      # Homepage (YouTube embed)
│   │   ├── about/                        # /about — How This Works
│   │   ├── signup/                       # /signup
│   │   ├── signin/                       # /signin
│   │   ├── discuss/                      # /discuss and thread pages
│   │   │   ├── actions.ts                # Server actions
│   │   │   ├── page.tsx
│   │   │   └── [category]/
│   │   │       ├── page.tsx
│   │   │       ├── new/page.tsx
│   │   │       └── [threadId]/
│   │   │           ├── page.tsx
│   │   │           ├── PostItem.tsx
│   │   │           ├── RatingButtons.tsx
│   │   │           └── RootReplyForm.tsx
│   │   ├── inbox/                        # /inbox
│   │   ├── review/                       # /review (held-post queue)
│   │   └── api/cron/ratings/             # Scheduled job endpoint
│   ├── components/
│   │   ├── SiteFooter.tsx
│   │   ├── DiscussHeader.tsx
│   │   └── SignOutButton.tsx
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts                 # Browser client
│   │   │   ├── server.ts                 # Server client
│   │   │   ├── service.ts                # Service-role client
│   │   │   └── proxy.ts                  # Session refresh helper
│   │   ├── rating/
│   │   │   ├── config.ts
│   │   │   ├── mf.ts                     # Matrix factorisation
│   │   │   └── decide.ts                 # Collapse decision
│   │   ├── filters/
│   │   │   ├── config.ts
│   │   │   └── filter.ts                 # Content filter
│   │   ├── admin.ts
│   │   ├── categories.ts
│   │   ├── discuss.ts
│   │   └── format.ts
│   └── proxy.ts                          # Next.js 16 proxy
├── supabase/
│   ├── schema.sql                        # Phase 1 schema
│   ├── phase2_migration.sql
│   └── phase3_migration.sql
├── scripts/
│   └── test-brigading.ts                 # Algorithm verification
├── docs/
│   └── RATING_SYSTEM.md
├── vercel.json                           # Cron config
├── .env.example
└── README.md
```

## Contributing

The code is public from day one. Fork it, run your own copy, or open a pull
request. Pull requests are reviewed for security, alignment with the
philosophy, and whether the code works. Once the site reaches a defined
number of active users, commit rights will be handed to a rotating group
elected by contributors.

## What this site will never do

No trackers. No analytics. No advertising. No third-party scripts. No
engagement loops. No notifications designed to pull you back. No private
messaging. No karma scores. No moderators with powers above the rules,
including the founder. When in doubt, the site chooses the simpler, calmer
option.
