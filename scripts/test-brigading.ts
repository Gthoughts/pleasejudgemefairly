// Brigading test for the cross-perspective rating algorithm.
//
// Runs four scenarios against the real fitMF implementation and
// checks whether each post ends up collapsed. The test uses an
// inline copy of the decide.ts logic so this script is self-
// contained and can run with nothing but plain Node:
//
//   node --experimental-strip-types scripts/test-brigading.ts
//
// (Node 22.6+; Node 23.6+ has strip-types enabled by default so the
// flag is a no-op on modern releases.)
//
// Exit code 0 on pass, 1 on any failure. Intentional: this script
// is also suitable for running in CI.

import { fitMF, type Rating } from '../src/lib/rating/mf.ts'

// --- Decision helper (mirrors src/lib/rating/decide.ts) -----------
// Keep in sync with the real decider. The duplication is deliberate:
// the test has to run without pulling in the Next.js build chain.

type Config = {
  minRatingsForCollapse: number
  minRaterActivity: number
  collapseThreshold: number
}

const CONFIG: Config = {
  minRatingsForCollapse: 10,
  minRaterActivity: 3,
  collapseThreshold: -0.3,
}

function decide(
  ratings: Rating[],
  postIntercepts: Map<string, number>,
  config: Config
) {
  const userTotals = new Map<string, number>()
  const postRaters = new Map<string, Set<string>>()
  for (const r of ratings) {
    userTotals.set(r.userId, (userTotals.get(r.userId) ?? 0) + 1)
    if (!postRaters.has(r.postId)) postRaters.set(r.postId, new Set())
    postRaters.get(r.postId)!.add(r.userId)
  }
  const decisions = new Map<
    string,
    { collapse: boolean; score: number; eligible: number; total: number }
  >()
  for (const [postId, score] of postIntercepts) {
    const raters = postRaters.get(postId) ?? new Set()
    let eligible = 0
    for (const uid of raters) {
      if ((userTotals.get(uid) ?? 0) >= config.minRaterActivity) {
        eligible++
      }
    }
    const collapse =
      eligible >= config.minRatingsForCollapse &&
      score < config.collapseThreshold
    decisions.set(postId, {
      collapse,
      score,
      eligible,
      total: raters.size,
    })
  }
  return decisions
}

// --- Runner -------------------------------------------------------

const MF = {
  epochs: 300,
  learningRate: 0.1,
  lambdaIntercept: 0.03,
  lambdaFactor: 0.05,
  initScale: 0.1,
  seed: 42,
}

type Scenario = {
  name: string
  ratings: Rating[]
  target: string
  expectCollapsed: boolean
  note: string
}

// Build a pool of "established" users with varied rating patterns
// across `nSeedPosts`. Used as a shared factor-space backdrop so
// later posts get scored against a realistic set of users.
function establishedUsers(count: number, nSeedPosts: number, startId = 0) {
  const ratings: Rating[] = []
  for (let u = 0; u < count; u++) {
    const uid = `user_seed_${startId + u}`
    // Each user has a stable random preference per seed post.
    for (let p = 0; p < nSeedPosts; p++) {
      const pid = `seed_post_${p}`
      // Split users into two factions that disagree on seed posts.
      // Faction A (even u) tends helpful on even p, unhelpful on odd.
      // Faction B (odd u) tends helpful on odd p, unhelpful on even.
      const faction = u % 2
      const helpful = (faction + p) % 2 === 0 ? 1 : 0
      ratings.push({ userId: uid, postId: pid, value: helpful as 0 | 1 })
    }
  }
  return ratings
}

// Scenario 1: 20 fresh accounts downvote the target, 5 established
// users rate it helpful. The brigade has no rating history, so the
// eligibility gate should prevent collapse even if MF produces a
// low score.
function scenarioNaiveBrigade(): Scenario {
  const target = 'target_post'
  const ratings: Rating[] = establishedUsers(50, 20)
  // 20 fresh accounts, each downvoting only the target:
  for (let i = 0; i < 20; i++) {
    ratings.push({
      userId: `fresh_brigade_${i}`,
      postId: target,
      value: 0,
    })
  }
  // 5 established users find it helpful:
  for (let i = 0; i < 5; i++) {
    ratings.push({
      userId: `user_seed_${i}`,
      postId: target,
      value: 1,
    })
  }
  return {
    name: 'naive brigade (fresh accounts)',
    ratings,
    target,
    expectCollapsed: false,
    note:
      'A post downvoted by 20 brand-new accounts must not collapse - the rater activity gate blocks it.',
  }
}

// Scenario 2: same 20 brigade accounts, but first they establish a
// shared factor vector by rating 30 seed posts in lockstep. They
// then downvote the target. Alongside, 5 diverse established users
// rate the target helpful. Even though the brigade has activity
// history, their SHARED rating pattern means the MF can absorb
// their disagreement in the factor dimension.
function scenarioEstablishedBrigade(): Scenario {
  const target = 'target_post'
  const ratings: Rating[] = establishedUsers(50, 20)

  // 20 brigade users who all rate 30 "brigade seed" posts 0 and
  // then downvote the target. Lockstep rating = identical factor.
  for (let u = 0; u < 20; u++) {
    const uid = `brigade_${u}`
    for (let p = 0; p < 30; p++) {
      ratings.push({
        userId: uid,
        postId: `brigade_seed_${p}`,
        value: 0,
      })
    }
    ratings.push({ userId: uid, postId: target, value: 0 })
  }

  // 5 diverse users who rate the target helpful.
  for (let i = 0; i < 5; i++) {
    ratings.push({
      userId: `user_seed_${i * 3}`,
      postId: target,
      value: 1,
    })
  }
  return {
    name: 'established brigade (shared factor)',
    ratings,
    target,
    expectCollapsed: false,
    note:
      'Even a brigade with rating history should not collapse the target because their lockstep pattern is absorbed by the factor dimension.',
  }
}

// Scenario 3: legitimate diverse consensus that a post is unhelpful.
// 12 users, each with real rating history across seed posts and
// genuinely varied factors, all rate the target unhelpful. This is
// what a real community downvote looks like and IS what the system
// is designed to catch.
function scenarioLegitimateConsensus(): Scenario {
  const target = 'target_post'
  const ratings: Rating[] = establishedUsers(50, 20)
  // 12 diverse users rate the target unhelpful. Draw them across
  // both factions so the signal is genuinely cross-perspective.
  for (let i = 0; i < 12; i++) {
    ratings.push({
      userId: `user_seed_${i}`,
      postId: target,
      value: 0,
    })
  }
  return {
    name: 'legitimate diverse consensus',
    ratings,
    target,
    expectCollapsed: true,
    note:
      '12 established users with varied histories all rate the target unhelpful. This is the only case the system is designed to collapse.',
  }
}

// Scenario 4: sanity check. A helpful post rated helpful by a
// diverse set of users should never collapse.
function scenarioHelpfulConsensus(): Scenario {
  const target = 'target_post'
  const ratings: Rating[] = establishedUsers(50, 20)
  for (let i = 0; i < 12; i++) {
    ratings.push({
      userId: `user_seed_${i}`,
      postId: target,
      value: 1,
    })
  }
  return {
    name: 'helpful consensus',
    ratings,
    target,
    expectCollapsed: false,
    note:
      'A post consistently rated helpful must never collapse.',
  }
}

function runScenario(s: Scenario): {
  pass: boolean
  score: number
  eligible: number
  total: number
  collapse: boolean
} {
  const mf = fitMF(s.ratings, MF)
  const decisions = decide(s.ratings, mf.postIntercepts, CONFIG)
  const d = decisions.get(s.target)
  if (!d) {
    return { pass: false, score: 0, eligible: 0, total: 0, collapse: false }
  }
  return {
    pass: d.collapse === s.expectCollapsed,
    score: d.score,
    eligible: d.eligible,
    total: d.total,
    collapse: d.collapse,
  }
}

const scenarios: Scenario[] = [
  scenarioNaiveBrigade(),
  scenarioEstablishedBrigade(),
  scenarioLegitimateConsensus(),
  scenarioHelpfulConsensus(),
]

let failures = 0
console.log('Brigading test for the cross-perspective rating algorithm')
console.log('Config:', CONFIG)
console.log('')

for (const s of scenarios) {
  const r = runScenario(s)
  const tag = r.pass ? 'PASS' : 'FAIL'
  console.log(`[${tag}] ${s.name}`)
  console.log(
    `       expectCollapsed=${s.expectCollapsed} got=${r.collapse} ` +
      `score=${r.score.toFixed(3)} eligible=${r.eligible} total=${r.total}`
  )
  console.log(`       ${s.note}`)
  console.log('')
  if (!r.pass) failures++
}

if (failures > 0) {
  console.error(`${failures} scenario(s) failed.`)
  process.exit(1)
}
console.log('All scenarios passed.')
