import type { createClient } from '@/lib/supabase/server'

export const CIPHER_SLUG_MIN = 3
export const CIPHER_SLUG_MAX = 60
export const CIPHER_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

export function slugifyCipher(input: string): string | null {
  const cleaned = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, CIPHER_SLUG_MAX)
    .replace(/-+$/g, '')
  if (cleaned.length < CIPHER_SLUG_MIN) return null
  return cleaned
}

export async function findFreeCipherSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  base: string
): Promise<string> {
  let candidate = base
  let n = 1
  while (true) {
    const { data, error } = await supabase
      .from('code_ciphers')
      .select('id')
      .eq('slug', candidate)
      .limit(1)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) return candidate
    n += 1
    const suffix = `-${n}`
    candidate = base.slice(0, CIPHER_SLUG_MAX - suffix.length) + suffix
  }
}
