'use server'

import { createClient } from '@/lib/supabase/server'

// Loose email shape check, mirroring the original landing page's validation.
// The DB enforces uniqueness; we only catch obvious malformed input here.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type SubscribeResult = {
  ok: boolean
  // One of: 'success' | 'duplicate' | 'invalid' | 'empty' | 'error'
  kind: 'success' | 'duplicate' | 'invalid' | 'empty' | 'error'
  message: string
}

// Add an email to the public.subscribers table.
//
// Anyone can call this (the table's RLS policy permits anon inserts).
// region is optional — the Merseyside landing page passes 'Merseyside';
// future regional pages will pass their own value. Stored lowercased
// and trimmed so duplicates collapse cleanly.
export async function subscribe(
  email: string,
  region: string | null
): Promise<SubscribeResult> {
  const cleaned = (email ?? '').trim().toLowerCase()

  if (!cleaned) {
    return {
      ok: false,
      kind: 'empty',
      message: 'Please enter your email address.',
    }
  }

  if (!EMAIL_REGEX.test(cleaned)) {
    return {
      ok: false,
      kind: 'invalid',
      message: 'That email doesn’t look quite right. Please check it.',
    }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('subscribers')
    .insert({ email: cleaned, region: region ?? null })

  if (error) {
    // Postgres unique-violation surface as code 23505 in supabase-js error.
    if (error.code === '23505') {
      return {
        ok: true,
        kind: 'duplicate',
        message: 'You’re already on the list. Thank you.',
      }
    }
    return {
      ok: false,
      kind: 'error',
      message: 'Something went wrong. Please try again.',
    }
  }

  return {
    ok: true,
    kind: 'success',
    message: 'Thank you. You’re part of it, and we’ll be in touch.',
  }
}
