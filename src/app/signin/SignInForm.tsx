'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Email + password sign-in via Supabase Auth. Email must already be verified
// — unverified accounts will be rejected by Supabase with a clear error.
export default function SignInForm({ next = '/' }: { next?: string }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setError(signInError.message)
      setSubmitting(false)
      return
    }

    router.push(next)
    router.refresh()
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

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-stone-700">Password</span>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded border border-stone-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
          autoComplete="current-password"
        />
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="mt-2 rounded bg-stone-900 text-stone-50 px-4 py-2 hover:bg-stone-700 disabled:opacity-60"
      >
        {submitting ? 'Signing in…' : 'Sign in'}
      </button>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </form>
  )
}
