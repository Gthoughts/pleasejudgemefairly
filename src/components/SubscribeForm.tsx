'use client'

import { useState, useTransition } from 'react'
import { subscribe } from '@/app/actions'

// Single-field email capture. The server action handles validation,
// duplicate-detection and the DB insert; this component is only
// responsible for the UI state. Region is fixed at mount time —
// regional landings will eventually pass their own value as a prop.
export default function SubscribeForm({
  region,
}: {
  region: string | null
}) {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [tone, setTone] = useState<'ok' | 'err' | ''>('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMessage('')
    setTone('')

    startTransition(async () => {
      const result = await subscribe(email, region)
      setMessage(result.message)
      setTone(result.ok ? 'ok' : 'err')
      if (result.kind === 'success') {
        setEmail('')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="flex flex-wrap gap-2.5">
        <input
          type="email"
          name="email"
          autoComplete="email"
          placeholder="your@email.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isPending}
          aria-label="Your email address"
          className="flex-[1_1_240px] bg-paper border border-line text-ink px-4 py-[15px] text-base outline-none transition-colors focus:border-moss disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={isPending}
          className="bg-ink text-paper font-semibold text-[15px] tracking-[0.02em] px-[26px] py-[15px] cursor-pointer transition-[background,transform] hover:bg-moss active:translate-y-[1px] disabled:opacity-60 disabled:cursor-default"
        >
          {isPending ? 'Adding…' : 'Count me in'}
        </button>
      </div>
      <div
        role="status"
        aria-live="polite"
        className={`mt-3.5 min-h-5 text-[14.5px] font-semibold ${
          tone === 'ok'
            ? 'text-moss'
            : tone === 'err'
              ? 'text-clay'
              : 'text-ink-soft'
        }`}
      >
        {message}
      </div>
      <p className="mt-4 text-[13px] text-ink-soft font-normal">
        Your email is used only to keep you informed about the Accord. It
        will not be shared, sold, or used for anything else.
      </p>
    </form>
  )
}
