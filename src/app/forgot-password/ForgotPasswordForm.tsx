'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Sends a Supabase password-recovery email. The link lands on /reset-password
// where the user sets a new password.
export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setMessage(null)

    const supabase = createClient()
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      { redirectTo: `${siteUrl}/auth/callback?next=/reset-password` }
    )

    if (resetError) {
      setError(resetError.message)
    } else {
      setMessage(
        'If an account exists for that email, a reset link is on its way. Open it in this browser.'
      )
    }
    setSubmitting(false)
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-stone-700">Email</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded border border-stone-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
          autoComplete="email"
        />
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="mt-2 rounded bg-stone-900 text-stone-50 px-4 py-2 hover:bg-stone-700 disabled:opacity-60"
      >
        {submitting ? 'Sending…' : 'Send reset link'}
      </button>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm text-stone-700">
          {message}
        </p>
      )}
    </form>
  )
}
