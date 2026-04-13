import Link from 'next/link'
import { redirect } from 'next/navigation'
import DiscussHeader from '@/components/DiscussHeader'
import SiteFooter from '@/components/SiteFooter'
import { createClient } from '@/lib/supabase/server'
import { formatWhen } from '@/lib/format'
import { getAdminUserIds, getDisplayUsername } from '@/lib/admin'

export const metadata = {
  title: 'Inbox — pleasejudgemefairly',
}

type ReplyRow = {
  id: string
  content: string
  created_at: string
  author_id: string
  parent_post_id: string
  thread_id: string
  users: { username: string } | null
  thread: { id: string; title: string; category: string } | null
}

// /inbox - a plain list of replies to the signed-in user's posts. No
// email notifications, no badges, no unread counts. You come here when
// you feel like it.
export default async function InboxPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/signin?next=/inbox')

  // 1. Fetch my own post ids.
  const { data: myPosts } = await supabase
    .from('posts')
    .select('id')
    .eq('author_id', user.id)

  const myIds = (myPosts ?? []).map((p) => p.id)

  // 2. Fetch replies to those posts, excluding my own replies, newest first.
  let replies: ReplyRow[] = []
  if (myIds.length > 0) {
    const { data } = await supabase
      .from('posts')
      .select(
        'id, content, created_at, author_id, parent_post_id, thread_id, users:author_id(username), thread:threads!thread_id(id, title, category)'
      )
      .in('parent_post_id', myIds)
      .neq('author_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)
      .returns<ReplyRow[]>()
    replies = data ?? []
  }

  // Hide replies from muted users (same treatment as the thread view).
  const { data: mutes } = await supabase
    .from('mutes')
    .select('muted_user_id')
    .eq('user_id', user.id)
  const mutedIds = new Set((mutes ?? []).map((m) => m.muted_user_id))
  const visible = replies.filter((r) => !mutedIds.has(r.author_id))
  const adminIds = await getAdminUserIds()

  return (
    <>
      <DiscussHeader />
      <main className="flex-1 px-6 py-12">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-2xl font-semibold">Inbox</h1>
          <p className="mt-2 text-sm text-stone-600">
            Replies to your posts. This page does not send you anything;
            check it when you want to.
          </p>

          {visible.length === 0 ? (
            <p className="mt-8 text-sm text-stone-500">
              Nothing here yet.
            </p>
          ) : (
            <ul className="mt-6 divide-y divide-stone-200 border-y border-stone-200">
              {visible.map((r) => (
                <li key={r.id} className="py-4">
                  <p className="text-sm text-stone-500">
                    <span className="font-medium text-stone-800">
                      {getDisplayUsername(r.author_id, r.users?.username ?? 'unknown', adminIds)}
                    </span>{' '}
                    replied to you in{' '}
                    {r.thread ? (
                      <Link
                        href={`/discuss/${r.thread.category}/${r.thread.id}`}
                        className="underline hover:text-stone-900"
                      >
                        {r.thread.title}
                      </Link>
                    ) : (
                      <span className="italic">(deleted thread)</span>
                    )}{' '}
                    · {formatWhen(r.created_at)}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-stone-800 text-sm">
                    {r.content.length > 400
                      ? r.content.slice(0, 400) + '…'
                      : r.content}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
