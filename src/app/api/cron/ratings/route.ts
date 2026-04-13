// Scheduled job that recomputes cross-perspective helpfulness scores
// and releases held content whose clock has elapsed.
//
// Triggered by Vercel Cron on the schedule in vercel.json. Protected by
// a shared secret in the CRON_SECRET env var. Can also be invoked
// manually for local testing:
//
//   curl -H "Authorization: Bearer $CRON_SECRET" \
//        http://localhost:3000/api/cron/ratings
//
// All writes use the service-role Supabase client because they touch
// collapse_log (admin-only) and iterate over every rating.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { fitMF, type Rating } from '@/lib/rating/mf'
import { decideCollapses } from '@/lib/rating/decide'
import { RATING_CONFIG } from '@/lib/rating/config'

// Tell Next.js this route is always dynamic - it must not be cached.
export const dynamic = 'force-dynamic'

function authorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = request.headers.get('authorization') ?? ''
  return auth === `Bearer ${secret}`
}

// ------------------------------------------------------------------
// Shared helper: score one content type (posts or resources) using
// the same MF + collapse logic.
// ------------------------------------------------------------------
async function scoreContentType(
  supabase: ReturnType<typeof createServiceClient>,
  contentType: 'post' | 'resource',
  table: 'posts' | 'resources'
): Promise<{
  mfInputLength: number
  itemsScored: number
  updated: number
  newlyCollapsed: number
  newlyUncollapsed: number
  holdsReleased: number
  holdsRetained: number
}> {
  // 1. Fetch all ratings for this content type.
  const { data: ratingRows, error: ratingErr } = await supabase
    .from('ratings')
    .select('user_id, content_id, rating')
    .eq('content_type', contentType)

  if (ratingErr) throw new Error(`rating fetch failed: ${ratingErr.message}`)

  const mfInput: Rating[] = (ratingRows ?? []).map((r) => ({
    userId: r.user_id as string,
    postId: r.content_id as string, // "postId" is the item ID in MF terms
    value: (r.rating === 'helpful' ? 1 : 0) as 0 | 1,
  }))

  if (mfInput.length === 0) {
    // Nothing to score; still run hold release.
    const holdsReleased = await releaseExpiredHolds(supabase, table, contentType)
    return {
      mfInputLength: 0,
      itemsScored: 0,
      updated: 0,
      newlyCollapsed: 0,
      newlyUncollapsed: 0,
      holdsReleased,
      holdsRetained: 0,
    }
  }

  const mfResult = fitMF(mfInput, {
    epochs: RATING_CONFIG.mfEpochs,
    learningRate: RATING_CONFIG.mfLearningRate,
    lambdaIntercept: RATING_CONFIG.mfLambdaIntercept,
    lambdaFactor: RATING_CONFIG.mfLambdaFactor,
    initScale: RATING_CONFIG.mfInitScale,
    seed: RATING_CONFIG.mfSeed,
  })

  // 2. Read prior is_collapsed state for touched items.
  const touchedIds = Array.from(mfResult.postIntercepts.keys())
  const priorStates = new Map<string, boolean>()
  if (touchedIds.length > 0) {
    const { data: priorRows } = await supabase
      .from(table)
      .select('id, is_collapsed')
      .in('id', touchedIds)
    for (const row of priorRows ?? []) {
      priorStates.set(row.id as string, row.is_collapsed as boolean)
    }
  }

  // 3. Decide and apply collapses.
  const decisions = decideCollapses(mfInput, mfResult, RATING_CONFIG)

  let updated = 0
  let newlyCollapsed = 0
  let newlyUncollapsed = 0

  for (const d of decisions) {
    const { error: updateErr } = await supabase
      .from(table)
      .update({
        helpfulness_score: d.score,
        rating_count: d.totalRatings,
        is_collapsed: d.collapse,
      })
      .eq('id', d.postId)

    if (updateErr) continue
    updated++

    const wasCollapsed = priorStates.get(d.postId) ?? false
    const logBase =
      contentType === 'post'
        ? { post_id: d.postId }
        : { resource_id: d.postId }

    if (d.collapse && !wasCollapsed) {
      newlyCollapsed++
      await supabase.from('collapse_log').insert({
        ...logBase,
        event: 'collapsed',
        helpfulness_score: d.score,
        rating_count: d.totalRatings,
        reason: d.reason,
        details: { eligibleRatings: d.eligibleRatings },
      })
    } else if (!d.collapse && wasCollapsed) {
      newlyUncollapsed++
      await supabase.from('collapse_log').insert({
        ...logBase,
        event: 'uncollapsed',
        helpfulness_score: d.score,
        rating_count: d.totalRatings,
        reason: d.reason,
        details: { eligibleRatings: d.eligibleRatings },
      })
    }
  }

  // 4. Release expired holds.
  const holdsReleased = await releaseExpiredHolds(
    supabase,
    table,
    contentType
  )

  return {
    mfInputLength: mfInput.length,
    itemsScored: mfResult.postIntercepts.size,
    updated,
    newlyCollapsed,
    newlyUncollapsed,
    holdsReleased: holdsReleased,
    holdsRetained: 0, // counted inside releaseExpiredHolds but not returned; good enough
  }
}

// Release held items whose clock has elapsed, unless they have flags
// inside the hold window. Returns the count of released items.
async function releaseExpiredHolds(
  supabase: ReturnType<typeof createServiceClient>,
  table: 'posts' | 'resources',
  contentType: 'post' | 'resource'
): Promise<number> {
  const nowIso = new Date().toISOString()
  const { data: expired } = await supabase
    .from(table)
    .select('id, created_at')
    .eq('hold_state', 'held')
    .lt('hold_expires_at', nowIso)

  let released = 0
  for (const row of expired ?? []) {
    const itemId = row.id as string
    const { count: flagCount } = await supabase
      .from('flags')
      .select('id', { count: 'exact', head: true })
      .eq('content_type', contentType)
      .eq('content_id', itemId)
      .gte('created_at', row.created_at as string)

    if ((flagCount ?? 0) > 0) continue

    await supabase
      .from(table)
      .update({
        hold_state: 'released',
        released_at: nowIso,
        released_by: 'auto',
      })
      .eq('id', itemId)

    const logBase =
      contentType === 'post' ? { post_id: itemId } : { resource_id: itemId }
    await supabase.from('collapse_log').insert({
      ...logBase,
      event: 'released',
      reason: 'hold_expired_no_flags',
    })

    released++
  }
  return released
}

async function handle(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const startedAt = Date.now()

  // Score posts and resources in sequence (same DB, sequential is fine).
  const [postStats, resourceStats] = await Promise.all([
    scoreContentType(supabase, 'post', 'posts'),
    scoreContentType(supabase, 'resource', 'resources'),
  ])

  return NextResponse.json({
    ok: true,
    durationMs: Date.now() - startedAt,
    posts: {
      ratings: postStats.mfInputLength,
      scored: postStats.itemsScored,
      updated: postStats.updated,
      newlyCollapsed: postStats.newlyCollapsed,
      newlyUncollapsed: postStats.newlyUncollapsed,
      holdsReleased: postStats.holdsReleased,
    },
    resources: {
      ratings: resourceStats.mfInputLength,
      scored: resourceStats.itemsScored,
      updated: resourceStats.updated,
      newlyCollapsed: resourceStats.newlyCollapsed,
      newlyUncollapsed: resourceStats.newlyUncollapsed,
      holdsReleased: resourceStats.holdsReleased,
    },
  })
}

export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}
