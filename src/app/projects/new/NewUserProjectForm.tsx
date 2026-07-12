'use client'

import { useState } from 'react'
import { createUserProjectAction } from '../actions'
import { USER_PROJECT_CATEGORIES } from '@/lib/user-projects/categories'
import ProjectLinksEditor from '../ProjectLinksEditor'

export default function NewUserProjectForm() {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(formData: FormData) {
    setSubmitting(true)
    setError(null)
    try {
      await createUserProjectAction(formData)
    } catch (err) {
      setSubmitting(false)
      const message = err instanceof Error ? err.message : String(err)
      // Server actions throw a redirect error on success — swallow that.
      if (message.includes('NEXT_REDIRECT')) return
      setError(message)
    }
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-5">
      <div>
        <label
          htmlFor="up-title"
          className="block text-sm font-medium text-stone-800"
        >
          Title
        </label>
        <input
          id="up-title"
          name="title"
          type="text"
          required
          maxLength={200}
          className="mt-1 w-full rounded border border-stone-300 bg-white px-3 py-2 text-stone-900 focus:border-stone-500 focus:outline-none"
        />
      </div>

      <div>
        <label
          htmlFor="up-category"
          className="block text-sm font-medium text-stone-800"
        >
          Category
        </label>
        <select
          id="up-category"
          name="category"
          required
          defaultValue=""
          className="mt-1 w-full rounded border border-stone-300 bg-white px-3 py-2 text-stone-900 focus:border-stone-500 focus:outline-none"
        >
          <option value="" disabled>
            Choose one…
          </option>
          {USER_PROJECT_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="up-short"
          className="block text-sm font-medium text-stone-800"
        >
          Short description
        </label>
        <p className="mt-0.5 text-xs text-stone-500">
          One or two sentences, shown on the listing page.
        </p>
        <textarea
          id="up-short"
          name="short_description"
          required
          maxLength={500}
          rows={2}
          className="mt-1 w-full rounded border border-stone-300 bg-white px-3 py-2 text-stone-900 focus:border-stone-500 focus:outline-none"
        />
      </div>

      <div>
        <label
          htmlFor="up-desc"
          className="block text-sm font-medium text-stone-800"
        >
          Description
        </label>
        <p className="mt-0.5 text-xs text-stone-500">
          Room for detail — what it is, where you are with it, and how
          people could get involved.
        </p>
        <textarea
          id="up-desc"
          name="description"
          required
          maxLength={50000}
          rows={10}
          className="mt-1 w-full rounded border border-stone-300 bg-white px-3 py-2 text-stone-900 focus:border-stone-500 focus:outline-none"
        />
      </div>

      <ProjectLinksEditor />

      {error ? (
        <p className="text-sm text-red-700">{error}</p>
      ) : null}

      <div>
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-stone-900 text-stone-50 px-4 py-2 text-sm hover:bg-stone-700 disabled:opacity-50"
        >
          {submitting ? 'Publishing…' : 'Publish project'}
        </button>
      </div>
    </form>
  )
}
