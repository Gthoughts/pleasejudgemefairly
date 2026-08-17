'use client'

import { useState } from 'react'
import AddEntryDialog from './AddEntryDialog'

// Floating plus button pinned to the bottom-right of the story page
// (only for the owner). Sits above the site-wide chat bubble via a
// smaller offset. Clicking opens the type-picker + entry form.
export default function AddEntryButton({ username }: { username: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Add an entry to your story"
        className="fixed bottom-24 right-5 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-stone-900 text-stone-50 shadow-lg ring-1 ring-stone-800/40 hover:bg-stone-700 hover:scale-105 transition sm:h-16 sm:w-16"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="h-7 w-7 sm:h-8 sm:w-8"
          aria-hidden="true"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
      {open && (
        <AddEntryDialog username={username} onClose={() => setOpen(false)} />
      )}
    </>
  )
}
