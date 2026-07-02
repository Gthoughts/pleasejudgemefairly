// Read-only audit: post ids + replies threaded under them, for
// user Anotherway18. Prepares the picture needed to decide on a
// delete strategy.
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

const { data: user } = await sb
  .from('users')
  .select('id, username, email')
  .eq('username', 'Anotherway18')
  .single()

const { data: posts } = await sb
  .from('posts')
  .select('id, thread_id, parent_post_id, content, created_at')
  .eq('author_id', user.id)
  .order('created_at', { ascending: true })

console.log(`User: ${user.username}  (${user.id})`)
console.log(`Posts: ${posts.length}`)
for (const p of posts) {
  console.log(`  post ${p.id}  thread=${p.thread_id}  parent=${p.parent_post_id ?? '(root)'}\n    "${p.content.replace(/\s+/g, ' ').slice(0, 200)}"`)
}

const postIds = posts.map((p) => p.id)

// Direct children (level 1 replies)
const { data: children } = await sb
  .from('posts')
  .select('id, thread_id, parent_post_id, author_id, content, created_at')
  .in('parent_post_id', postIds)

console.log(`\nDirect replies to Anotherway18's posts: ${children.length}`)

if (children.length > 0) {
  const authorIds = [...new Set(children.map((c) => c.author_id))]
  const { data: authors } = await sb.from('users').select('id, username').in('id', authorIds)
  const nameOf = Object.fromEntries((authors ?? []).map((a) => [a.id, a.username]))
  for (const c of children) {
    console.log(`  by ${nameOf[c.author_id]} → "${c.content.replace(/\s+/g, ' ').slice(0, 160)}"`)
  }
}

// Thread context
const threadIds = [...new Set(posts.map((p) => p.thread_id))]
const { data: threads } = await sb
  .from('threads')
  .select('id, category, title, author_id')
  .in('id', threadIds)

const threadAuthorIds = [...new Set(threads.map((t) => t.author_id))]
const { data: tAuthors } = await sb
  .from('users')
  .select('id, username')
  .in('id', threadAuthorIds)
const tNameOf = Object.fromEntries((tAuthors ?? []).map((a) => [a.id, a.username]))

console.log(`\nThreads Anotherway18 posted in:`)
for (const t of threads) {
  console.log(`  [${t.category}] "${t.title}"  by ${tNameOf[t.author_id]}  (id=${t.id})`)
}
