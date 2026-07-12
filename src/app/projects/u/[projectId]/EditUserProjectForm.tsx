'use client'

import { useState } from 'react'
import {
  editUserProjectAction,
  deleteUserProjectAction,
} from '../../actions'
import { USER_PROJECT_CATEGORIES } from '@/lib/user-projects/categories'
import type { ProjectLink } from '@/lib/user-projects/links'
import ProjectLinksEditor from '../../ProjectLinksEditor'

type Props = {
  projectId: string
  initialTitle: string
  initialShortDescription: string
  initialDescription: string
  initialCategory: string
  initialLinks: ProjectLink[]
}

export default function EditUserProjectForm({
  projectId,
  initialTitle,
  initialShortDescription,
  initialDescription,
  initialCategory,
  initialLinks,
}: Props) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function onEdit(formData: FormData) {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await editUserProjectAction(formData)
      setSaved(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (!message.includes('NEXT_REDIRECT')) setError(message)
    } finally {
      setSaving(false)
    }
  }

  async function onDelete(formData: FormData) {
    if (
      !confirm(
        'Delete this project? This cannot be undone.'
      )
    ) {
      return
    }
    setSaving(true)
    setError(null)
    try {
      await deleteUserProjectAction(formData)
    } catch (err) {
      setSaving(false)
      const message = err instanceof Error ? err.message : String(err)
      if (!message.includes('NEXT_REDIRECT')) setError(message)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form action={onEdit} className="flex flex-col gap-5">
        <input type="hidden" name="project_id" value={projectId} />

        <div>
          <label className="block text-sm font-medium text-stone-800">
            Title
          </label>
          <input
            name="title"
            type="text"
            required
            maxLength={200}
            defaultValue={initialTitle}
            className="mt-1 w-full rounded border border-stone-300 bg-white px-3 py-2 text-stone-900 focus:border-stone-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-800">
            Category
          </label>
          <select
            name="category"
            required
            defaultValue={initialCategory}
            className="mt-1 w-full rounded border border-stone-300 bg-white px-3 py-2 text-stone-900 focus:border-stone-500 focus:outline-none"
          >
            {USER_PROJECT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-800">
            Short description
          </label>
          <textarea
            name="short_description"
            required
            maxLength={500}
            rows={2}
            defaultValue={initialShortDescription}
            className="mt-1 w-full rounded border border-stone-300 bg-white px-3 py-2 text-stone-900 focus:border-stone-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-800">
            Description
          </label>
          <textarea
            name="description"
            required
            maxLength={50000}
            rows={10}
            defaultValue={initialDescription}
            className="mt-1 w-full rounded border border-stone-300 bg-white px-3 py-2 text-stone-900 focus:border-stone-500 focus:outline-none"
          />
        </div>

        <ProjectLinksEditor initial={initialLinks} />

        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        {saved ? (
          <p className="text-sm text-green-700">Saved.</p>
        ) : null}

        <div>
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-stone-900 text-stone-50 px-4 py-2 text-sm hover:bg-stone-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>

      <form action={onDelete}>
        <input type="hidden" name="project_id" value={projectId} />
        <button
          type="submit"
          disabled={saving}
          className="text-sm text-red-700 underline hover:text-red-900 disabled:opacity-50"
        >
          Delete this project
        </button>
      </form>
    </div>
  )
}
