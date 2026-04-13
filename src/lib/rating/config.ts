// Tunable parameters for the cross-perspective rating system.
//
// Every value here can be overridden by an environment variable at boot
// time. The defaults deliberately err on the side of NOT collapsing
// content - false negatives (bad content stays visible) are recoverable;
// false positives (good content gets hidden) destroy trust in the system.
// See docs/RATING_SYSTEM.md for the full reasoning.

function num(envVar: string | undefined, fallback: number): number {
  if (envVar === undefined || envVar === '') return fallback
  const n = Number(envVar)
  return Number.isFinite(n) ? n : fallback
}

export const RATING_CONFIG = {
  // --- Collapse thresholds ---------------------------------------------
  // A post is collapsed only if ALL THREE are true:
  //   - it has received at least minRatingsForCollapse ratings from
  //     raters who each have at least minRaterActivity total ratings
  //     on the site (the "eligible" rating count)
  //   - its helpfulness_score (post intercept after MF) is below
  //     collapseThreshold
  //
  // The minimum eligible ratings floor prevents brigading by fresh
  // accounts: 20 accounts with no history downvoting one post do not
  // collect enough eligible ratings to make the post collapsible at
  // all, no matter how negative their score is.
  //
  // The threshold is deliberately negative-and-conservative: the
  // community has to genuinely agree the content is unhelpful, not
  // just be split.
  minRatingsForCollapse: num(process.env.RATING_MIN_RATINGS_FOR_COLLAPSE, 10),
  minRaterActivity: num(process.env.RATING_MIN_RATER_ACTIVITY, 3),
  collapseThreshold: num(process.env.RATING_COLLAPSE_THRESHOLD, -0.3),

  // --- Matrix factorisation hyperparameters ----------------------------
  // Batch gradient descent over the 1-dim model
  //   r̂(u, p) = mu + i_u + i_p + f_u * f_p
  // See src/lib/rating/mf.ts for the maths.
  mfEpochs: num(process.env.RATING_MF_EPOCHS, 300),
  mfLearningRate: num(process.env.RATING_MF_LEARNING_RATE, 0.1),
  mfLambdaIntercept: num(process.env.RATING_MF_LAMBDA_INTERCEPT, 0.03),
  mfLambdaFactor: num(process.env.RATING_MF_LAMBDA_FACTOR, 0.05),
  mfInitScale: num(process.env.RATING_MF_INIT_SCALE, 0.1),
  mfSeed: num(process.env.RATING_MF_SEED, 42),

  // --- Held post release window ---------------------------------------
  // When the filter flags a submission, the post is held for this many
  // hours. The banner ("held for review - may be removed if flagged")
  // is visible to everyone during the hold, and the community can rate
  // or flag it. The cron job releases the hold when the clock runs out,
  // unless the post has received new flags in the window - in which
  // case it stays held until an admin acts.
  holdWindowHours: num(process.env.RATING_HOLD_WINDOW_HOURS, 24),
} as const
