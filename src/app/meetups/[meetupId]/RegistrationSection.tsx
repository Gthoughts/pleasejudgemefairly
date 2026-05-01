'use client'

import { useState, useTransition } from 'react'
import { registerForMeetupAction, unregisterFromMeetupAction } from '../actions'

type Question = { id: string; question_text: string; display_order: number }

type Props = {
  meetupId: string
  questions: Question[]
  isRegistered: boolean
  isWaitlisted: boolean
  isFull: boolean
  isCancelled: boolean
  attendeeCount: number
  maxAttendees: number | null
  attendees: string[] // usernames of confirmed registrants
}

export default function RegistrationSection({
  meetupId,
  questions,
  isRegistered,
  isWaitlisted,
  isFull,
  isCancelled,
  attendeeCount,
  maxAttendees,
  attendees,
}: Props) {
  const [showForm, setShowForm] = useState(false)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  async function handleRegister(waitlist = false) {
    setError(null)
    const formData = new FormData()
    formData.set('meetup_id', meetupId)
    if (waitlist) formData.set('waitlist', 'true')
    questions.forEach((q) => {
      formData.append('question_id', q.id)
      formData.append('answer', answers[q.id] ?? '')
    })
    startTransition(async () => {
      try {
        await registerForMeetupAction(formData)
        setShowForm(false)
        setAnswers({})
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Registration failed.')
      }
    })
  }

  async function handleUnregister() {
    setError(null)
    const formData = new FormData()
    formData.set('meetup_id', meetupId)
    startTransition(async () => {
      try {
        await unregisterFromMeetupAction(formData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not unregister.')
      }
    })
  }

  return (
    <div>
      {/* Attendee count */}
      <p className="text-sm text-stone-600">
        <span className="font-medium">{attendeeCount}</span>{' '}
        {attendeeCount === 1 ? 'person' : 'people'} registered
        {maxAttendees !== null && (
          <span className="text-stone-400"> (max {maxAttendees})</span>
        )}
      </p>

      {/* Attendee list */}
      {attendees.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {attendees.map((username) => (
            <span
              key={username}
              className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-600"
            >
              {username}
            </span>
          ))}
        </div>
      )}

      {/* Registration controls */}
      <div className="mt-4">
        {isCancelled ? (
          <p className="text-sm text-stone-500">This meetup has been cancelled.</p>
        ) : isRegistered ? (
          <div className="flex items-center gap-4">
            <span className="text-sm text-stone-600">
              You&rsquo;re registered{isWaitlisted ? ' (waitlist)' : ''}.
            </span>
            <button
              type="button"
              onClick={handleUnregister}
              disabled={pending}
              className="text-sm text-stone-500 underline hover:text-stone-800 disabled:opacity-60"
            >
              {pending ? 'Unregistering…' : 'Unregister'}
            </button>
          </div>
        ) : isFull ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-stone-600">This meetup is full.</p>
            <button
              type="button"
              onClick={() =>
                questions.length > 0 ? setShowForm(true) : handleRegister(true)
              }
              disabled={pending}
              className="self-start rounded border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:border-stone-500 hover:text-stone-900 disabled:opacity-60"
            >
              {pending ? 'Joining waitlist…' : 'Join waitlist'}
            </button>
          </div>
        ) : showForm && questions.length > 0 ? (
          <div className="rounded border border-stone-200 bg-stone-50 p-4 flex flex-col gap-4">
            <p className="text-sm font-medium text-stone-700">A few questions from the organiser:</p>
            {questions.map((q) => (
              <label key={q.id} className="flex flex-col gap-1 text-sm">
                <span className="text-stone-700">{q.question_text}</span>
                <textarea
                  rows={2}
                  maxLength={500}
                  value={answers[q.id] ?? ''}
                  onChange={(e) =>
                    setAnswers((a) => ({ ...a, [q.id]: e.target.value }))
                  }
                  className="rounded border border-stone-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-stone-400 text-sm"
                />
              </label>
            ))}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleRegister(false)}
                disabled={pending}
                className="rounded bg-stone-900 text-stone-50 px-4 py-2 text-sm hover:bg-stone-700 disabled:opacity-60"
              >
                {pending ? 'Confirming…' : 'Confirm registration'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-sm text-stone-600 hover:underline"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() =>
              questions.length > 0 ? setShowForm(true) : handleRegister(false)
            }
            disabled={pending}
            className="rounded bg-stone-900 text-stone-50 px-4 py-2 text-sm hover:bg-stone-700 disabled:opacity-60"
          >
            {pending ? 'Registering…' : 'Register interest'}
          </button>
        )}

        {error && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
