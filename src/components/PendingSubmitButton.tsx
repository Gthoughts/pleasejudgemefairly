'use client'

import { useFormStatus } from 'react-dom'

// Submit button that reflects the parent <form>'s pending state via
// useFormStatus. Disables itself, dims, shows a loud "Sending…" label
// plus a spinner while the server action is in flight. Drop-in anywhere
// a plain <button type="submit"> would sit.
//
// Also fades the whole form when active by rendering a sibling <div>
// covering the parent form via CSS class hook, so users have no doubt
// the click registered.

type Props = {
  idle: string
  pending?: string
  className?: string
}

export default function PendingSubmitButton({
  idle,
  pending = 'Sending…',
  className,
}: Props) {
  const { pending: isPending } = useFormStatus()

  const buttonClass =
    className ??
    'inline-flex items-center gap-2 rounded bg-stone-900 text-stone-50 px-4 py-2 text-sm hover:bg-stone-700 disabled:cursor-wait disabled:bg-stone-500'

  return (
    <button type="submit" disabled={isPending} className={buttonClass}>
      {isPending ? (
        <>
          <Spinner />
          <span>{pending}</span>
        </>
      ) : (
        <span>{idle}</span>
      )}
    </button>
  )
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="4"
      />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  )
}
