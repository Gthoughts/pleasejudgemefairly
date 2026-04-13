'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Sign-up form. Creates a Supabase Auth user and triggers the email
// verification flow. The username is stored in user_metadata for now; a
// database trigger will copy it into the public.users table on confirmation
// (that wiring happens alongside the schema in supabase/schema.sql).
export default function SignUpForm() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username },
        emailRedirectTo: `${siteUrl}/signin`,
      },
    })

    if (signUpError) {
      setError(signUpError.message)
    } else {
      setMessage(
        'Check your email for a verification link before signing in.'
      )
    }
    setSubmitting(false)
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-stone-700">Username</span>
        <input
          type="text"
          required
          minLength={3}
          maxLength={32}
          pattern="[A-Za-z0-9_\-]+"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="rounded border border-stone-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
          autoComplete="username"
        />
      </label>

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
        {submitting ? 'Creating account…' : 'Create account'}
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
