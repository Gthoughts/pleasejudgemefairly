'use client'

import { useState } from 'react'
import { addPollAction } from '../actions'

const MAX_OPTIONS = 8
const MIN_OPTIONS = 2

export default function AddPollForm({ meetupId }: { meetupId: string }) {
  // Each option row is keyed so React reorders/removes cleanly. We only
  // track keys; the values live in the uncontrolled inputs and are read
  // by the server action from the FormData (name="poll_option").
  const [optionKeys, setOptionKeys] = useState<number[]>([0, 1])

  const addOption = () => {
    setOptionKeys((keys) =>
      keys.length >= MAX_OPTIONS ? keys : [...keys, (keys[keys.length - 1] ?? 0) + 1]
    )
  }

  const removeOption = (key: number) => {
    setOptionKeys((keys) => (keys.length <= MIN_OPTIONS ? keys : keys.filter((k) => k !== key)))
  }

  return (
    <form action={addPollAction} className="mt-6 flex flex-col gap-3">
      <input type="hidden" name="meetup_id" value={meetupId} />

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-stone-700 font-medium">Poll question</span>
        <input
          name="poll_title"
          type="text"
          required
          maxLength={200}
          placeholder="e.g. Which weekend works best?"
          className="rounded border border-stone-300 px-3 py-2 text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-stone-700 font-medium">Type</span>
        <select
          name="poll_type"
          defaultValue="custom"
          className="w-fit rounded border border-stone-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
        >
          <option value="date">Dates</option>
          <option value="location">Locations</option>
          <option value="custom">Other</option>
        </select>
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-stone-700">Options</span>
        {optionKeys.map((key, idx) => (
          <div key={key} className="flex gap-2">
            <input
              name="poll_option"
              type="text"
              maxLength={200}
              placeholder={`Option ${idx + 1}`}
              className="flex-1 rounded border border-stone-300 px-3 py-2 text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
            />
            <button
              type="button"
              onClick={() => removeOption(key)}
              disabled={optionKeys.length <= MIN_OPTIONS}
              className="rounded border border-stone-300 px-3 py-2 text-sm text-stone-500 hover:border-stone-500 hover:text-stone-900 disabled:opacity-40 disabled:hover:border-stone-300 disabled:hover:text-stone-500"
            >
              Remove
            </button>
          </div>
        ))}
        {optionKeys.length < MAX_OPTIONS && (
          <button
            type="button"
            onClick={addOption}
            className="w-fit text-sm text-stone-600 underline hover:text-stone-900"
          >
            + Add option
          </button>
        )}
      </div>

      <div>
        <button
          type="submit"
          className="rounded bg-stone-900 text-stone-50 px-4 py-2 text-sm hover:bg-stone-700"
        >
          Add poll
        </button>
      </div>
    </form>
  )
}
