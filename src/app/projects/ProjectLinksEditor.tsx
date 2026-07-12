'use client'

import { useState } from 'react'
import { MAX_PROJECT_LINKS, type ProjectLink } from '@/lib/user-projects/links'

type Row = { label: string; url: string }

function toRows(initial: ProjectLink[] | undefined): Row[] {
  if (!initial || initial.length === 0) return [{ label: '', url: '' }]
  return initial.map((l) => ({ label: l.label, url: l.url }))
}

export default function ProjectLinksEditor({
  initial,
}: {
  initial?: ProjectLink[]
}) {
  const [rows, setRows] = useState<Row[]>(toRows(initial))

  function setRow(i: number, patch: Partial<Row>) {
    setRows((prev) =>
      prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r))
    )
  }

  function addRow() {
    if (rows.length >= MAX_PROJECT_LINKS) return
    setRows((prev) => [...prev, { label: '', url: '' }])
  }

  function removeRow(i: number) {
    setRows((prev) => {
      const next = prev.filter((_, idx) => idx !== i)
      return next.length === 0 ? [{ label: '', url: '' }] : next
    })
  }

  return (
    <fieldset className="rounded border border-stone-200 p-4">
      <legend className="px-1 text-sm font-medium text-stone-800">
        Links (optional)
      </legend>
      <p className="mt-0.5 text-xs text-stone-500">
        Website, docs, socials, wherever you&rsquo;d like people to click
        through. Up to {MAX_PROJECT_LINKS}.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        {rows.map((row, i) => (
          <div key={i} className="flex flex-col gap-2 sm:flex-row sm:items-start">
            <input
              name={`link_label_${i}`}
              type="text"
              maxLength={100}
              placeholder="Label (optional)"
              value={row.label}
              onChange={(e) => setRow(i, { label: e.target.value })}
              className="w-full sm:w-48 rounded border border-stone-300 bg-white px-3 py-2 text-stone-900 focus:border-stone-500 focus:outline-none"
            />
            <input
              name={`link_url_${i}`}
              type="text"
              inputMode="url"
              maxLength={1000}
              placeholder="example.com or https://…"
              value={row.url}
              onChange={(e) => setRow(i, { url: e.target.value })}
              className="w-full flex-1 rounded border border-stone-300 bg-white px-3 py-2 text-stone-900 focus:border-stone-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => removeRow(i)}
              className="shrink-0 rounded border border-stone-300 px-3 py-2 text-sm text-stone-600 hover:border-stone-500 hover:text-stone-900"
              aria-label={`Remove link ${i + 1}`}
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      {rows.length < MAX_PROJECT_LINKS ? (
        <button
          type="button"
          onClick={addRow}
          className="mt-4 rounded border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:border-stone-500 hover:text-stone-900"
        >
          + Add another link
        </button>
      ) : null}
    </fieldset>
  )
}
