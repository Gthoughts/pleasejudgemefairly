'use client'

import { useState } from 'react'
import { submitCipherAction } from '../actions'

const fieldClass =
  'rounded border border-stone-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-stone-400'

export default function NewCipherForm() {
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const formData = new FormData(e.currentTarget)
      await submitCipherAction(formData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-stone-700 font-medium">Title</span>
        <input
          name="title"
          type="text"
          required
          maxLength={200}
          placeholder="e.g. Shugborough Monument"
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-stone-700 font-medium">Summary</span>
        <input
          name="summary"
          type="text"
          required
          maxLength={500}
          placeholder="A one-line hook"
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-stone-700 font-medium">The cipher</span>
        <textarea
          name="cipher_text"
          required
          maxLength={2000}
          rows={3}
          placeholder="e.g. OUOSVAVV DM"
          className={fieldClass + ' font-mono'}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-stone-700 font-medium">Decoded reading</span>
        <textarea
          name="decoded_reading"
          required
          maxLength={5000}
          rows={3}
          placeholder="What the cipher decodes to"
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-stone-700 font-medium">Method</span>
        <textarea
          name="method"
          required
          maxLength={20000}
          rows={10}
          placeholder="How was it decoded? Walk through the steps."
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-stone-700 font-medium">
          Sources{' '}
          <span className="font-normal text-stone-400">(optional)</span>
        </span>
        <textarea
          name="sources"
          maxLength={5000}
          rows={3}
          placeholder="Links or citations, one per line"
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-stone-700 font-medium">
          URL slug{' '}
          <span className="font-normal text-stone-400">
            (optional, defaults to a slug of the title)
          </span>
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-stone-500 select-none">wrenbrmn.org/code/</span>
          <input
            name="slug"
            type="text"
            maxLength={60}
            pattern="[A-Za-z0-9 \-]+"
            placeholder="shugborough"
            className={fieldClass + ' flex-1'}
          />
        </div>
      </label>

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
          {submitting ? 'Submitting…' : 'Submit for review'}
        </button>
      </div>
    </form>
  )
}
