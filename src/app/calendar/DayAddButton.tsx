'use client'

import { useState } from 'react'
import Link from 'next/link'

// Small "+" affordance for a calendar day cell. Because it is interactive
// (toggles a popover), it lives in a client component so the calendar page
// itself can stay a handler-free server component.
export default function DayAddButton({ date }: { date: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Add something on ${date}`}
        aria-expanded={open}
        className="flex h-5 w-5 items-center justify-center rounded text-stone-400 hover:bg-stone-100 hover:text-stone-700"
      >
        +
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 min-w-40 rounded border border-stone-200 bg-white py-1 text-xs shadow-md">
          <Link
            href={`/meetups/new?date=${date}`}
            className="block px-3 py-2 text-stone-700 hover:bg-stone-50"
          >
            Add a meetup
          </Link>
          <Link
            href={`/helpouts/new?date=${date}`}
            className="block px-3 py-2 text-stone-700 hover:bg-stone-50"
          >
            Ask for help
          </Link>
        </div>
      )}
    </div>
  )
}
