import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Handles the redirect Supabase Auth sends users to after they click a
// confirmation, magic-link, recovery, or invite email. Supports both the
// PKCE code flow (?code=…) and the newer token-hash OTP flow
// (?token_hash=…&type=…). Sets the auth cookies via the server client
// and redirects to `next` (or /) on success. On failure it redirects
// to /signin with a small error hint.

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as
    | 'signup'
    | 'magiclink'
    | 'recovery'
    | 'invite'
    | 'email_change'
    | 'email'
    | null
  const rawNext = searchParams.get('next')
  const next =
    rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//')
      ? rawNext
      : '/'

  const supabase = await createClient()

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      return NextResponse.redirect(
        `${origin}/signin?auth_error=${encodeURIComponent(error.message)}`
      )
    }
    // Password-recovery links should always land on the reset page,
    // whatever next was passed.
    if (type === 'recovery') {
      return NextResponse.redirect(`${origin}/reset-password`)
    }
    return NextResponse.redirect(`${origin}${next}`)
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    })
    if (error) {
      return NextResponse.redirect(
        `${origin}/signin?auth_error=${encodeURIComponent(error.message)}`
      )
    }
    if (type === 'recovery') {
      return NextResponse.redirect(`${origin}/reset-password`)
    }
    return NextResponse.redirect(`${origin}${next}`)
  }

  return NextResponse.redirect(
    `${origin}/signin?auth_error=${encodeURIComponent(
      'Missing or invalid confirmation link.'
    )}`
  )
}
