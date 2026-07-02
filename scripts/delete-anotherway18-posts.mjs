// Destructive: deletes the 3 posts authored by Anotherway18 and any
// ratings/flags that reference those posts by content_id. The user
// account itself is left in place.
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

const POST_IDS = [
  'e107441e-df79-49ad-a874-d5be18edc89d',
  'f89789b1-a85d-4f91-a0e0-850ba32066e9',
  'be610af4-802d-4054-a426-c87c665aa565',
]

// Re-verify author before we delete — abort if anything looks off.
const { data: check, error: checkErr } = await sb
  .from('posts')
  .select('id, author_id, users:author_id (username)')
  .in('id', POST_IDS)

if (checkErr) {
  console.error('pre-check error:', checkErr)
  process.exit(1)
}

if (!check || check.length !== 3) {
  console.error(`expected 3 posts, found ${check?.length ?? 0}. aborting.`)
  process.exit(1)
}

for (const p of check) {
  if (p.users?.username !== 'Anotherway18') {
    console.error(`post ${p.id} is not by Anotherway18 (author=${p.users?.username}). aborting.`)
    process.exit(1)
  }
}

console.log('pre-check ok: 3 posts, all by Anotherway18.')

// Clean up polymorphic ratings + flags first (no FK cascade to posts on these).
const { data: delRatings, error: rErr } = await sb
  .from('ratings')
  .delete()
  .eq('content_type', 'post')
  .in('content_id', POST_IDS)
  .select('id')
if (rErr) { console.error('rating delete error:', rErr); process.exit(1) }
console.log(`deleted ratings: ${delRatings?.length ?? 0}`)

const { data: delFlags, error: fErr } = await sb
  .from('flags')
  .delete()
  .eq('content_type', 'post')
  .in('content_id', POST_IDS)
  .select('id')
if (fErr) { console.error('flag delete error:', fErr); process.exit(1) }
console.log(`deleted flags: ${delFlags?.length ?? 0}`)

// collapse_log has FK on delete cascade so it'll clean itself when posts go.
const { data: delPosts, error: pErr } = await sb
  .from('posts')
  .delete()
  .in('id', POST_IDS)
  .select('id')
if (pErr) { console.error('post delete error:', pErr); process.exit(1) }
console.log(`deleted posts: ${delPosts?.length ?? 0}`)

// Confirm they're gone.
const { data: remain } = await sb.from('posts').select('id').in('id', POST_IDS)
console.log(`remaining rows with those ids: ${remain?.length ?? 0}`)
