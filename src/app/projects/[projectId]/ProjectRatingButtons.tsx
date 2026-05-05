'use client'

import { useState, useTransition } from 'react'
import { rateProjectPostAction } from '../actions'

export default function ProjectRatingButtons({
  postId,
  projectId,
  initialRating,
}: {
  postId: string
  projectId: string
  initialRating: 'helpful' | 'unhelpful' | null
}) {
  const [rating, setRating] = useState<'helpful' | 'unhelpful' | null>(
    initialRating
  )
  const [pending, startTransition] = useTransition()

  function submit(next: 'helpful' | 'unhelpful' | '') {
    setRating(next === '' ? null : next)
    const formData = new FormData()
    formData.set('post_id', postId)
    formData.set('project_id', projectId)
    formData.set('rating', next)
    startTransition(async () => {
      try {
        await rateProjectPostAction(formData)
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
        {rating === 'helpful' ? 'helpful ✓' : 'helpful'}
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
        {rating === 'unhelpful' ? 'unhelpful ✓' : 'unhelpful'}
      </button>
    </div>
  )
}
