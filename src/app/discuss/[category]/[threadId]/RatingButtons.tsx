'use client'

import { useState, useTransition } from 'react'
import { rateAction } from '../../actions'

// Two quiet buttons: helpful / unhelpful. The chosen one shows a ✓.
// Clicking the opposite button changes the vote. Clicking the same
// button again removes the rating (unrate). No counts, no scores, no
// totals are ever displayed - those live on posts.helpfulness_score
// and are computed by the cron job, never exposed in the UI.
//
// Accessibility: both buttons are real <button> elements with
// role="radio" inside a radiogroup, aria-checked reflecting state,
// and descriptive aria-labels so screen readers announce the action
// and its current state clearly.
export default function RatingButtons({
  postId,
  initialRating,
  redirectTo,
}: {
  postId: string
  initialRating: 'helpful' | 'unhelpful' | null
  redirectTo: string
}) {
  const [rating, setRating] = useState<'helpful' | 'unhelpful' | null>(
    initialRating
  )
  const [pending, startTransition] = useTransition()

  function submit(next: 'helpful' | 'unhelpful' | '') {
    // Optimistic local state so the checkmark flips immediately.
    setRating(next === '' ? null : next)

    const formData = new FormData()
    formData.set('post_id', postId)
    formData.set('rating', next)
    formData.set('redirect_to', redirectTo)

    startTransition(async () => {
      try {
        await rateAction(formData)
      } catch {
        // Revert on error.
        setRating(initialRating)
      }
    })
  }

  const onHelpful = () => submit(rating === 'helpful' ? '' : 'helpful')
  const onUnhelpful = () => submit(rating === 'unhelpful' ? '' : 'unhelpful')

  return (
    <div
      role="radiogroup"
      aria-label="Rate this post"
      className="flex items-center gap-2 text-xs"
    >
      <button
        type="button"
        role="radio"
        aria-checked={rating === 'helpful'}
        aria-label={
          rating === 'helpful'
            ? 'You rated this post helpful. Click to remove your rating.'
            : 'Rate this post helpful.'
        }
        disabled={pending}
        onClick={onHelpful}
        className={
          rating === 'helpful'
            ? 'rounded border border-stone-700 bg-stone-100 px-2 py-1 text-stone-800'
            : 'rounded border border-stone-300 bg-white px-2 py-1 text-stone-600 hover:border-stone-500 hover:text-stone-800'
        }
      >
        {rating === 'helpful' ? 'helpful \u2713' : 'helpful'}
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={rating === 'unhelpful'}
        aria-label={
          rating === 'unhelpful'
            ? 'You rated this post unhelpful. Click to remove your rating.'
            : 'Rate this post unhelpful.'
        }
        disabled={pending}
        onClick={onUnhelpful}
        className={
          rating === 'unhelpful'
            ? 'rounded border border-stone-700 bg-stone-100 px-2 py-1 text-stone-800'
            : 'rounded border border-stone-300 bg-white px-2 py-1 text-stone-600 hover:border-stone-500 hover:text-stone-800'
        }
      >
        {rating === 'unhelpful' ? 'unhelpful \u2713' : 'unhelpful'}
      </button>
    </div>
  )
}
