'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

// Landing page for the Supabase recovery email. The browser client exchanges
// the ?code= in the URL for a session automatically on load; once a user is
// present we show the new-password form. Also works for anyone already
// signed in who just wants to change their password.
export default function ResetPasswordForm() {
  const router = useRouter()
  const [status, setStatus] = useState<'checking' | 'ready' | 'invalid'>(
    'checking'
  )
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setStatus('ready')
    })

    // The code exchange may still be in flight on first check, so retry once
    // before declaring the link invalid.
    let cancelled = false
    async function check(attempt: number) {
      const { data } = await supabase.auth.getUser()
      if (cancelled) return
      if (data.user) {
        setStatus('ready')
      } else if (attempt < 2) {
        setTimeout(() => check(attempt + 1), 1500)
      } else {
        setStatus((s) => (s === 'checking' ? 'invalid' : s))
      }
    }
    check(0)

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    })

    if (updateError) {
      setError(updateError.message)
      setSubmitting(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  if (status === 'checking') {
    return <p className="text-sm text-stone-600">Checking your link…</p>
  }

  if (status === 'invalid') {
    return (
      <div className="flex flex-col gap-3 text-sm text-stone-700">
        <p role="alert" className="text-red-700">
          This reset link is invalid or has expired. Links only work in the
          browser you requested them from.
        </p>
        <p>
          <Link
            href="/forgot-password"
            className="underline underline-offset-4 hover:text-stone-900"
          >
            Request a new reset link
          </Link>
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-stone-700">New password</span>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded border border-stone-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
          autoComplete="new-password"
        />
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="mt-2 rounded bg-stone-900 text-stone-50 px-4 py-2 hover:bg-stone-700 disabled:opacity-60"
      >
        {submitting ? 'Saving…' : 'Set new password'}
      </button>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </form>
  )
}
