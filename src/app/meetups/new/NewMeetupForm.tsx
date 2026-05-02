'use client'

import { useState, useRef } from 'react'
import { createMeetupAction } from '../actions'

const MAX_QUESTIONS = 5

export default function NewMeetupForm() {
  const [questions, setQuestions] = useState<string[]>([])
  const [isOnline, setIsOnline] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  function addQuestion() {
    if (questions.length < MAX_QUESTIONS) {
      setQuestions((q) => [...q, ''])
    }
  }

  function removeQuestion(idx: number) {
    setQuestions((q) => q.filter((_, i) => i !== idx))
  }

  function updateQuestion(idx: number, value: string) {
    setQuestions((q) => q.map((v, i) => (i === idx ? value : v)))
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const formData = new FormData(e.currentTarget)
      // Inject question values (named question_0 ... question_4).
      questions.forEach((q, i) => formData.set(`question_${i}`, q))
      formData.set('is_online', isOnline ? 'true' : 'false')
      await createMeetupAction(formData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setSubmitting(false)
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-6">
      {/* Title */}
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-stone-700 font-medium">Title</span>
        <input
          name="title"
          type="text"
          required
          maxLength={200}
          placeholder="e.g. Manchester reading group"
          className="rounded border border-stone-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
        />
      </label>

      {/* Description */}
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-stone-700 font-medium">Description</span>
        <textarea
          name="description"
          required
          maxLength={5000}
          rows={4}
          placeholder="What is this meetup about?"
          className="rounded border border-stone-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
        />
      </label>

      {/* Date and time */}
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-stone-700 font-medium">Date and time</span>
        <input
          name="date_time"
          type="datetime-local"
          required
          className="rounded border border-stone-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-stone-400 w-fit"
        />
      </label>

      {/* Location */}
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-stone-700 font-medium">Location</span>
        <input
          name="location"
          type="text"
          required
          maxLength={200}
          placeholder='e.g. "Manchester city centre" or "Online"'
          className="rounded border border-stone-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
        />
      </label>

      {/* Online toggle */}
      <div className="flex items-center gap-3 text-sm">
        <button
          type="button"
          role="switch"
          aria-checked={isOnline}
          onClick={() => setIsOnline((v) => !v)}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-stone-400 ${
            isOnline ? 'bg-stone-900' : 'bg-stone-300'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              isOnline ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
        <span className="text-stone-700">Online event</span>
      </div>

      {/* Max attendees */}
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-stone-700 font-medium">
          Maximum attendees{' '}
          <span className="font-normal text-stone-400">(optional — leave blank for unlimited)</span>
        </span>
        <input
          name="max_attendees"
          type="number"
          min={1}
          max={10000}
          placeholder="e.g. 30"
          className="rounded border border-stone-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-stone-400 w-32"
        />
      </label>

      {/* Registration questions */}
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium text-stone-700">
          Registration questions{' '}
          <span className="font-normal text-stone-400">(optional, up to {MAX_QUESTIONS})</span>
        </legend>
        <p className="text-xs text-stone-500">
          Attendees answer these when they register. Leave empty for a one-click
          registration.
        </p>
        {questions.map((q, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <input
              type="text"
              value={q}
              onChange={(e) => updateQuestion(idx, e.target.value)}
              maxLength={500}
              placeholder={`Question ${idx + 1}`}
              className="flex-1 rounded border border-stone-300 px-3 py-2 text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
            />
            <button
              type="button"
              onClick={() => removeQuestion(idx)}
              className="text-stone-400 hover:text-red-600 text-xs"
            >
              Remove
            </button>
          </div>
        ))}
        {questions.length < MAX_QUESTIONS && (
          <button
            type="button"
            onClick={addQuestion}
            className="self-start text-sm text-stone-600 underline hover:text-stone-900"
          >
            + Add a question
          </button>
        )}
      </fieldset>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      <div>
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-stone-900 text-stone-50 px-6 py-2.5 text-sm hover:bg-stone-700 disabled:opacity-60"
        >
          {submitting ? 'Creating…' : 'Create meetup'}
        </button>
      </div>
    </form>
  )
}
