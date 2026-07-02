// Read-only: for each supplied post id, list children (replies) whose
// parent_post_id equals it.
// Usage: node scripts/find-replies-to.mjs <postId> [<postId> ...]
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    }),
)

const sb = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const ids = process.argv.slice(2)
if (ids.length === 0) {
  console.error('usage: node scripts/find-replies-to.mjs <postId> [...]')
  process.exit(1)
}

const { data, error } = await sb
  .from('posts')
  .select('id, thread_id, parent_post_id, author_id, content, created_at')
  .in('parent_post_id', ids)

if (error) {
  console.error(error)
  process.exit(1)
}

console.log(`REPLIES to those ${ids.length} post(s): ${data?.length ?? 0}`)

if (!data || data.length === 0) process.exit(0)

const authorIds = [...new Set(data.map((r) => r.author_id))]
const { data: authors } = await sb
  .from('users')
  .select('id, username')
  .in('id', authorIds)
const nameOf = Object.fromEntries((authors ?? []).map((a) => [a.id, a.username]))

for (const r of data) {
  const preview = r.content.replace(/\s+/g, ' ').slice(0, 140)
  console.log(
    `  parent=${r.parent_post_id}\n    by ${nameOf[r.author_id] ?? r.author_id} at ${r.created_at}\n    ${preview}${r.content.length > 140 ? '…' : ''}`,
  )
}
