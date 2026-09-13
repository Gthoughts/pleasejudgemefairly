'use client'

import { useState } from 'react'
import { volunteerAction, withdrawAction } from '../actions'

type DateItem = { id: string; the_date: string }

type Props = {
  helpOutId: string
  dates: DateItem[]
  myDateIds: string[]
}

function formatDate(iso: string): string {
  // the_date is a yyyy-mm-dd string; append time to avoid timezone drift.
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function VolunteerForm({ helpOutId, dates, myDateIds }: Props) {
  const [checked, setChecked] = useState<Set<string>>(new Set(myDateIds))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasExisting = myDateIds.length > 0

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setError(null)
    if (checked.size === 0) {
      setError('Tick at least one date you can help with.')
      return
    }
    setBusy(true)
    try {
      const fd = new FormData()
      fd.set('help_out_id', helpOutId)
      checked.forEach((id) => fd.append('date_id', id))
      await volunteerAction(fd)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  async function withdraw() {
    if (busy) return
    setError(null)
    setBusy(true)
    try {
      const fd = new FormData()
      fd.set('help_out_id', helpOutId)
      await withdrawAction(fd)
      setChecked(new Set())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded border border-stone-200 bg-stone-50 p-4">
      <h3 className="text-sm font-medium text-stone-800">I can help</h3>
      <p className="mt-0.5 text-xs text-stone-500">
        Tick every date you could lend a hand. You can pick more than one.
      </p>
      <form onSubmit={submit} className="mt-3 flex flex-col gap-2">
        {dates.map((d) => (
          <label key={d.id} className="flex items-center gap-2 text-sm text-stone-800">
            <input
              type="checkbox"
              checked={checked.has(d.id)}
              onChange={() => toggle(d.id)}
              className="h-4 w-4"
            />
            <span>{formatDate(d.the_date)}</span>
          </label>
        ))}

        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={busy}
            className="rounded bg-stone-900 text-stone-50 px-4 py-2 text-sm hover:bg-stone-700 disabled:opacity-60"
          >
            {busy ? 'Saving…' : hasExisting ? 'Update my offer' : 'I can help'}
          </button>
          {hasExisting && (
            <button
              type="button"
              onClick={withdraw}
              disabled={busy}
              className="text-sm text-stone-500 underline hover:text-stone-800 disabled:opacity-60"
            >
              Withdraw my offer
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
