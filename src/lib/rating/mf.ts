/**
 * One-dimensional matrix factorisation for cross-perspective rating.
 *
 * ---------------------------------------------------------------
 * What this does, in plain English
 * ---------------------------------------------------------------
 *
 * We want to decide which posts the community broadly agrees are
 * unhelpful, without letting any single faction silence dissent.
 *
 * The trick - lifted from Twitter/X Community Notes - is to fit a
 * simple linear model to the ratings data:
 *
 *   r̂(u, p) = mu + i_u + i_p + f_u * f_p
 *
 * where r ∈ {0, 1} is "unhelpful" / "helpful", mu is a global
 * intercept, i_u and i_p are per-user and per-post intercepts, and
 * f_u and f_p are one-dimensional "factor" values that can capture
 * polarisation along a single axis.
 *
 * The insight: if users split along a factional line, the factor
 * term (f_u * f_p) can absorb the disagreement, leaving the post's
 * intercept (i_p) near zero. A post only gets a low i_p if users
 * from DIFFERENT factions both rate it unhelpful, which is the
 * strongest possible signal of cross-perspective agreement.
 *
 * We collapse a post when i_p falls below a (negative) threshold
 * AND the post has received a minimum number of ratings. The raw
 * number of unhelpful votes is never the decision criterion.
 *
 * See docs/RATING_SYSTEM.md for tuning notes and the explicit list
 * of things this system IS and IS NOT designed to do.
 *
 * ---------------------------------------------------------------
 * Implementation
 * ---------------------------------------------------------------
 *
 * Plain batch gradient descent, no external dependencies. For the
 * scale this project will run at (thousands of users, tens of
 * thousands of ratings at most for a long time) this is fine:
 * O(epochs * |ratings|) per cron cycle, which runs in a few hundred
 * milliseconds.
 *
 * The global intercept `mu` is fixed to the mean rating rather than
 * learned - this is numerically more stable at small scale and
 * doesn't change the relative ranking of posts.
 */

export type Rating = {
  userId: string
  postId: string
  value: 0 | 1 // 0 = unhelpful, 1 = helpful
}

export type MFConfig = {
  epochs: number
  learningRate: number
  lambdaIntercept: number
  lambdaFactor: number
  initScale: number
  seed: number
}

export type MFResult = {
  mu: number
  userIntercepts: Map<string, number>
  postIntercepts: Map<string, number>
  userFactors: Map<string, number>
  postFactors: Map<string, number>
  postRatingCounts: Map<string, number>
}

// Seeded PRNG (Mulberry32) so the cron job produces reproducible
// initialisations. Determinism makes the math easy to debug.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function fitMF(ratings: Rating[], config: MFConfig): MFResult {
  if (ratings.length === 0) {
    return {
      mu: 0,
      userIntercepts: new Map(),
      postIntercepts: new Map(),
      userFactors: new Map(),
      postFactors: new Map(),
      postRatingCounts: new Map(),
    }
  }

  const userIds = Array.from(new Set(ratings.map((r) => r.userId)))
  const postIds = Array.from(new Set(ratings.map((r) => r.postId)))

  const rand = mulberry32(config.seed)
  const init = (scale: number) => (rand() - 0.5) * 2 * scale

  // Fix the global intercept to the mean rating. At very small scale
  // this is more stable than learning it, and it doesn't affect the
  // relative ranking of posts.
  const mu = ratings.reduce((s, r) => s + r.value, 0) / ratings.length

  const i_u = new Map<string, number>()
  const i_p = new Map<string, number>()
  const f_u = new Map<string, number>()
  const f_p = new Map<string, number>()
  for (const u of userIds) {
    i_u.set(u, 0)
    f_u.set(u, init(config.initScale))
  }
  for (const p of postIds) {
    i_p.set(p, 0)
    f_p.set(p, init(config.initScale))
  }

  const postRatingCounts = new Map<string, number>()
  const userRatingCounts = new Map<string, number>()
  for (const r of ratings) {
    postRatingCounts.set(r.postId, (postRatingCounts.get(r.postId) ?? 0) + 1)
    userRatingCounts.set(r.userId, (userRatingCounts.get(r.userId) ?? 0) + 1)
  }

  const lr = config.learningRate
  const lambdaI = config.lambdaIntercept
  const lambdaF = config.lambdaFactor

  // Batch gradient descent. Accumulate gradients across all ratings
  // for one full epoch, then apply per-parameter (averaged over the
  // number of ratings that parameter participates in so the learning
  // rate stays sensible across users with different activity levels).
  for (let epoch = 0; epoch < config.epochs; epoch++) {
    const dI_u = new Map<string, number>()
    const dI_p = new Map<string, number>()
    const dF_u = new Map<string, number>()
    const dF_p = new Map<string, number>()
    for (const u of userIds) {
      dI_u.set(u, 0)
      dF_u.set(u, 0)
    }
    for (const p of postIds) {
      dI_p.set(p, 0)
      dF_p.set(p, 0)
    }

    for (const r of ratings) {
      const iu = i_u.get(r.userId)!
      const ip = i_p.get(r.postId)!
      const fu = f_u.get(r.userId)!
      const fp = f_p.get(r.postId)!
      const err = r.value - (mu + iu + ip + fu * fp)

      dI_u.set(r.userId, dI_u.get(r.userId)! + err)
      dI_p.set(r.postId, dI_p.get(r.postId)! + err)
      dF_u.set(r.userId, dF_u.get(r.userId)! + err * fp)
      dF_p.set(r.postId, dF_p.get(r.postId)! + err * fu)
    }

    for (const u of userIds) {
      const n = userRatingCounts.get(u)!
      i_u.set(u, i_u.get(u)! + lr * (dI_u.get(u)! / n - lambdaI * i_u.get(u)!))
      f_u.set(u, f_u.get(u)! + lr * (dF_u.get(u)! / n - lambdaF * f_u.get(u)!))
    }
    for (const p of postIds) {
      const n = postRatingCounts.get(p)!
      i_p.set(p, i_p.get(p)! + lr * (dI_p.get(p)! / n - lambdaI * i_p.get(p)!))
      f_p.set(p, f_p.get(p)! + lr * (dF_p.get(p)! / n - lambdaF * f_p.get(p)!))
    }
  }

  return {
    mu,
    userIntercepts: i_u,
    postIntercepts: i_p,
    userFactors: f_u,
    postFactors: f_p,
    postRatingCounts,
  }
}
