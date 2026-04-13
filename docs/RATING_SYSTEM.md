# How the rating system works

This document explains, in plain English, how pleasejudgemefairly
decides which posts the community has broadly agreed are unhelpful.
Users have the right to know how their content is being judged;
contributors need to understand the maths so they can improve it.

---

## What it rewards, what it penalises

The system is a thin layer on top of a simple idea: a post is only
collapsed if people who normally disagree with each other **both**
rate it unhelpful. Agreement across different viewpoints is the
strongest possible signal that a post deserves to be quieted.

It **rewards**:

- Posts rated helpful by users with different rating patterns (posts
  that cross perspectives).
- Posts that most people simply ignore. Doing nothing is a perfectly
  valid response; the algorithm only considers explicit ratings.
- Posts on unpopular or minority viewpoints, as long as those posts
  are thoughtful enough that some users with different politics still
  find them useful.

It **penalises**:

- Posts that are clearly low quality and broadly agreed to be so.
- Spam and solicitation (in combination with the automatic content
  filter, which holds those posts for review at submission time).

It is **neutral** about:

- Disagreement along a single factional line. If only one side rates
  a post unhelpful, the algorithm treats it as polarising content and
  does not collapse it. Factions cannot silence each other by
  brigading.

---

## The maths (short version)

We fit a simple linear model to the ratings data:

```
r̂(u, p) = μ + i_u + i_p + f_u · f_p
```

where:

- `r` ∈ {0, 1} — the observed rating (0 = unhelpful, 1 = helpful)
- `μ` — global mean rating (fixed to the actual mean, not learned)
- `i_u` — per-user intercept ("does this user tend to rate things
  helpful or unhelpful in general?")
- `i_p` — per-post intercept ("after accounting for who rated it,
  is this post helpful or unhelpful on average?")
- `f_u` — per-user factor, a single scalar capturing which "side"
  the user tends to agree with
- `f_p` — per-post factor, a single scalar capturing which "side"
  the post aligns with

The factor term (`f_u · f_p`) can absorb disagreement that splits
along a single axis. If a post is only rated unhelpful by users on
one side of that axis, the factor term explains it and the post's
intercept stays near zero. If users on **both** sides rate it
unhelpful, the factor term can't explain that, so the intercept has
to go negative to fit the data.

The helpfulness score we use for the collapse decision is `i_p` —
the post intercept — and a post is collapsed when:

```
i_p < collapseThreshold           AND
eligibleRatings >= minRatingsForCollapse
```

`eligibleRatings` is the number of ratings on the post made by
users with at least `minRaterActivity` total ratings across the
site. The eligibility gate exists to defend against brigading by
fresh accounts: 20 accounts that sign up purely to downvote a
single post do not count towards eligibility, so the post cannot be
collapsed on their votes alone. See the brigading test script
(`scripts/test-brigading.ts`) for an executable demonstration.

All thresholds are configurable via environment variables. Defaults
lean conservatively towards **not** collapsing content. See
`src/lib/rating/config.ts`.

The model is fit with plain batch gradient descent, 300 epochs,
one-dimensional factors, no external ML dependencies. The code lives
in `src/lib/rating/mf.ts` and is intentionally small so contributors
can read and audit it.

This approach is a simplified version of the matrix factorisation
algorithm used by Twitter/X Community Notes ("Birdwatch"). The
Community Notes algorithm is open source and worth reading if you
want the full paper:
<https://github.com/twitter/communitynotes>.

---

## When the collapse decision is made

Scores are recalculated every 15 minutes by a cron job
(`/api/cron/ratings`), protected by a shared secret. It does three
things in order:

1. Reads every rating in the database and fits the model.
2. Updates `posts.helpfulness_score`, `posts.rating_count`, and
   `posts.is_collapsed` for every post that has at least one rating.
3. Logs any new collapse or uncollapse events to `public.collapse_log`
   so the history can be audited.

A post that was collapsed in one run can be **uncollapsed** in a
future run if enough new helpful ratings come in. Collapse is never
permanent.

---

## Tuning

All knobs are in `src/lib/rating/config.ts`. You do not need to
touch code to change any of them; set the matching environment
variable and redeploy.

| Setting                        | Env var                              | Default |
| ------------------------------ | ------------------------------------ | ------- |
| Minimum eligible ratings       | `RATING_MIN_RATINGS_FOR_COLLAPSE`    | `10`    |
| Min rater activity             | `RATING_MIN_RATER_ACTIVITY`          | `3`     |
| Collapse threshold             | `RATING_COLLAPSE_THRESHOLD`          | `-0.3`  |
| MF gradient descent epochs     | `RATING_MF_EPOCHS`                   | `300`   |
| MF learning rate               | `RATING_MF_LEARNING_RATE`            | `0.1`   |
| MF L2 on intercepts            | `RATING_MF_LAMBDA_INTERCEPT`         | `0.03`  |
| MF L2 on factors               | `RATING_MF_LAMBDA_FACTOR`            | `0.05`  |
| MF init scale                  | `RATING_MF_INIT_SCALE`               | `0.1`   |
| MF seeded init RNG             | `RATING_MF_SEED`                     | `42`    |
| Held post window (hours)       | `RATING_HOLD_WINDOW_HOURS`           | `24`    |

### How to make it more or less strict

- **Collapse more aggressively.** Raise the threshold closer to `0`
  (e.g. `-0.1`) or lower the minimum ratings floor (e.g. `6`). Do
  not do this without monitoring for false positives.
- **Collapse less aggressively.** Lower the threshold (more
  negative, e.g. `-0.5`) or raise the minimum ratings floor (e.g.
  `20`). At small user counts this is almost always the safer choice.

### The default bias

The defaults above deliberately err on the side of **not** collapsing
content. The reasoning is blunt:

> False negatives (bad content stays visible for longer) are
> recoverable. False positives (good content gets hidden) destroy
> trust in the system.

Until the community is big enough for the matrix factorisation to
have real signal, treat any collapse as a hint, not a verdict, and
log any false positives you see.

---

## Limitations at small scale

The algorithm needs real ratings data to work. With 20 users and
100 ratings, the scores are noisy and you should not trust any
individual collapse decision. We mitigate this in a few ways:

1. Nothing collapses until a post has at least 10 ratings.
2. The collapse threshold is well below zero; a post needs a clear
   negative bias across viewpoints, not just a split vote.
3. Nothing is ever deleted. A collapsed post is always readable with
   one click.

Even so, **real tuning has to happen on real data.** The numbers in
`config.ts` are starting points, not answers.

---

## What this system CAN be used for, and what it CANNOT

This system is designed to:

- Surface content that the community broadly finds helpful.
- Dampen content that the community broadly finds unhelpful, even
  when the raters come from different viewpoints.
- Resist brigading by small factions, because single-faction
  disagreement is absorbed into the polarisation factor rather than
  treated as a community judgement.

This system is **not** designed to:

- **Detect truth.** Matrix factorisation does not know what is true.
  It measures agreement across viewpoints, which is a useful signal
  but is not the same thing as correctness. Popular wisdom can be
  wrong; unpopular truths can exist.
- **Replace individual judgement.** A collapsed post is a hint that
  readers from different perspectives found something unhelpful
  about it. It is not a verdict. Readers should still click through
  and form their own view whenever they want to. The "show this
  post" link is always there because the community does not own
  anyone's eyes.
- **Decide who is right in an argument.** Two thoughtful posts that
  disagree with each other can both be highly rated. Two thoughtful
  posts that disagree with each other can also both be collapsed if
  the argument was unpleasant enough that readers on both sides
  found both posts unhelpful. Neither outcome means either post was
  wrong.
- **Moderate content that breaks laws or standards.** The content
  filter handles soliciting and money-making at submission time. UK
  illegal content categories are outside the scope of this
  algorithm; they need human review.
- **Substitute for reading the room.** Collapse is a blunt
  instrument. It tells you something was less welcome than average.
  Nothing more.

If you find yourself reasoning about this system as if it were a
truth detector, or as if collapse meant "this post is wrong", stop
and reread this section. The collapse is a hint, not a verdict.

---

## Auditing and transparency

Every collapse and release event is recorded in the `collapse_log`
table, which is readable only by the service role (i.e. the cron
job and database admins). The log records:

- The post ID
- What happened (`collapsed`, `uncollapsed`, `held`, `released`,
  `hold_expired`)
- The helpfulness score and rating count at the time
- A short reason string
- Any extra context as JSON

If a user is surprised by a collapse, the log should make it
possible to reconstruct what happened and when. Future work may
expose a per-user "why was my post collapsed" page, but only after
the community has decided it wants one.
