// Read-only lookup: find users by username pattern (case-insensitive)
// and, if a single match, enumerate their content.
// Usage: node scripts/find-user-posts.mjs <substring>
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

const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('missing env')
  process.exit(1)
}

const query = process.argv[2]
if (!query) {
  console.error('usage: node scripts/find-user-posts.mjs <substring>')
  process.exit(1)
}

const sb = createClient(url, key, { auth: { persistSession: false } })

const { data: users, error: uErr } = await sb
  .from('users')
  .select('id, username, email, created_at, last_active')
  .ilike('username', `%${query}%`)

if (uErr) {
  console.error('user lookup error:', uErr)
  process.exit(1)
}

console.log(`MATCHING USERS (case-insensitive substring "${query}"): ${users?.length ?? 0}`)
for (const u of users ?? []) {
  console.log(`  ${u.username}  (id=${u.id}  created=${u.created_at}  last_active=${u.last_active})`)
}

if (!users || users.length !== 1) {
  process.exit(0)
}

const user = users[0]
console.log()

const { data: threads } = await sb
  .from('threads')
  .select('id, category, title, created_at')
  .eq('author_id', user.id)
  .order('created_at', { ascending: false })

const { data: posts } = await sb
  .from('posts')
  .select('id, thread_id, parent_post_id, content, created_at')
  .eq('author_id', user.id)
  .order('created_at', { ascending: false })

console.log(`THREADS created by ${user.username}: ${threads?.length ?? 0}`)
for (const t of threads ?? []) {
  console.log(`  [${t.category}] ${t.title}  (id=${t.id})`)
}
console.log()

console.log(`POSTS authored by ${user.username}: ${posts?.length ?? 0}`)
for (const p of posts ?? []) {
  const preview = p.content.replace(/\s+/g, ' ').slice(0, 140)
  console.log(
    `  ${p.created_at}  thread=${p.thread_id}  parent=${p.parent_post_id ?? '(root)'}\n    ${preview}${p.content.length > 140 ? '…' : ''}`,
  )
}
