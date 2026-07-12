'use client'

import { useState } from 'react'
import { deleteResourceAction } from '../../actions'

export default function DeleteResourceButton({
  resourceId,
  category,
}: {
  resourceId: string
  category: string
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onDelete(formData: FormData) {
    if (
      !confirm(
        'Delete this resource? This cannot be undone.'
      )
    ) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      await deleteResourceAction(formData)
    } catch (err) {
      setBusy(false)
      const message = err instanceof Error ? err.message : String(err)
      if (!message.includes('NEXT_REDIRECT')) setError(message)
    }
  }

  return (
    <form action={onDelete} className="inline-flex flex-col items-start gap-1">
      <input type="hidden" name="resource_id" value={resourceId} />
      <input type="hidden" name="category" value={category} />
      <button
        type="submit"
        disabled={busy}
        className="text-xs text-red-700 underline underline-offset-4 hover:text-red-900 disabled:opacity-50"
      >
        {busy ? 'Deleting…' : 'Delete resource'}
      </button>
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </form>
  )
}
