'use client'

import { useState, useTransition } from 'react'
import { rateResourceAction } from '../../actions'

// Rating buttons for library resources. Identical UI to the post
// RatingButtons component but calls rateResourceAction with
// resource_id instead of post_id.
export default function ResourceRatingButtons({
  resourceId,
  initialRating,
  redirectTo,
}: {
  resourceId: string
  initialRating: 'helpful' | 'unhelpful' | null
  redirectTo: string
}) {
  const [rating, setRating] = useState<'helpful' | 'unhelpful' | null>(
    initialRating
  )
  const [pending, startTransition] = useTransition()

  function submit(next: 'helpful' | 'unhelpful' | '') {
    setRating(next === '' ? null : next)

    const formData = new FormData()
    formData.set('resource_id', resourceId)
    formData.set('rating', next)
    formData.set('redirect_to', redirectTo)

    startTransition(async () => {
      try {
        await rateResourceAction(formData)
      } catch {
        setRating(initialRating)
      }
    })
  }

  const onHelpful = () => submit(rating === 'helpful' ? '' : 'helpful')
  const onUnhelpful = () => submit(rating === 'unhelpful' ? '' : 'unhelpful')

  return (
    <div
      role="radiogroup"
      aria-label="Rate this resource"
      className="flex items-center gap-2 text-xs"
    >
      <button
        type="button"
        role="radio"
        aria-checked={rating === 'helpful'}
        aria-label={
          rating === 'helpful'
            ? 'You rated this resource helpful. Click to remove your rating.'
            : 'Rate this resource helpful.'
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
            ? 'You rated this resource unhelpful. Click to remove your rating.'
            : 'Rate this resource unhelpful.'
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
