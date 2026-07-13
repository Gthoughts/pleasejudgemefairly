'use client'

import { useState } from 'react'
import { updateResourceSubjectAction } from '../../actions'
import { LIBRARY_SUBJECTS } from '@/lib/library-subjects'

export default function EditSubjectForm({
  resourceId,
  category,
  initialSubject,
}: {
  resourceId: string
  category: string
  initialSubject: string | null
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function onSave(formData: FormData) {
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      await updateResourceSubjectAction(formData)
      setSaved(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (!message.includes('NEXT_REDIRECT')) setError(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      action={onSave}
      className="flex flex-col gap-2 sm:flex-row sm:items-center"
    >
      <input type="hidden" name="resource_id" value={resourceId} />
      <input type="hidden" name="category" value={category} />
      <label
        htmlFor="edit-subject"
        className="text-xs font-medium text-stone-700"
      >
        Topic
      </label>
      <select
        id="edit-subject"
        name="subject"
        required
        defaultValue={initialSubject ?? ''}
        className="rounded border border-stone-300 bg-white px-2 py-1 text-sm text-stone-900 focus:border-stone-500 focus:outline-none"
      >
        <option value="" disabled>
          Choose one…
        </option>
        {LIBRARY_SUBJECTS.map((s) => (
          <option key={s.slug} value={s.slug}>
            {s.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={busy}
        className="rounded border border-stone-300 px-3 py-1 text-xs text-stone-700 hover:border-stone-500 hover:text-stone-900 disabled:opacity-50"
      >
        {busy ? 'Saving…' : 'Save'}
      </button>
      {saved ? (
        <span className="text-xs text-green-700">Saved.</span>
      ) : null}
      {error ? <span className="text-xs text-red-700">{error}</span> : null}
    </form>
  )
}
