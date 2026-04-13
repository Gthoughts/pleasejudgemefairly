// Collapse decision helper.
//
// Given the output of fitMF plus per-user rating-count information,
// decide whether each post meets the collapse threshold. The cron
// job uses this; the brigading test script uses the same function
// so the test mirrors real behaviour.

import type { MFResult, Rating } from './mf'
import { RATING_CONFIG } from './config'

export type CollapseDecision = {
  postId: string
  score: number
  totalRatings: number
  eligibleRatings: number
  collapse: boolean
  reason: string
}

// Build indices over ratings: total ratings per user, raters per
// post. O(|ratings|) one-pass.
export function indexRatings(ratings: Rating[]) {
  const userTotals = new Map<string, number>()
  const postRaters = new Map<string, Set<string>>()
  for (const r of ratings) {
    userTotals.set(r.userId, (userTotals.get(r.userId) ?? 0) + 1)
    if (!postRaters.has(r.postId)) postRaters.set(r.postId, new Set())
    postRaters.get(r.postId)!.add(r.userId)
  }
  return { userTotals, postRaters }
}

// Compute the collapse decision for every post in the MF result.
// Returns one decision per post, whether it collapses or not, so the
// cron job can update every row in one pass.
export function decideCollapses(
  ratings: Rating[],
  mfResult: MFResult,
  config: typeof RATING_CONFIG
): CollapseDecision[] {
  const { userTotals, postRaters } = indexRatings(ratings)
  const decisions: CollapseDecision[] = []

  for (const [postId, score] of mfResult.postIntercepts) {
    const raters = postRaters.get(postId) ?? new Set()
    const total = raters.size
    let eligible = 0
    for (const uid of raters) {
      if ((userTotals.get(uid) ?? 0) >= config.minRaterActivity) {
        eligible++
      }
    }

    let collapse = false
    let reason = 'ok'
    if (eligible < config.minRatingsForCollapse) {
      reason = 'not_enough_eligible_ratings'
    } else if (score >= config.collapseThreshold) {
      reason = 'score_above_threshold'
    } else {
      collapse = true
      reason = 'cross_perspective_threshold'
    }

    decisions.push({
      postId,
      score,
      totalRatings: total,
      eligibleRatings: eligible,
      collapse,
      reason,
    })
  }

  return decisions
}
