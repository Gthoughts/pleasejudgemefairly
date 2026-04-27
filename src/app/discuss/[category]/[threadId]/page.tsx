import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import DiscussHeader from '@/components/DiscussHeader'
import SiteFooter from '@/components/SiteFooter'
import { getCategory } from '@/lib/categories'
import { createClient } from '@/lib/supabase/server'
import PostItem from './PostItem'
import RootReplyForm from './RootReplyForm'
import { MAX_REPLY_DEPTH } from '@/lib/discuss'
import { getAdminUserIds, getDisplayUsername } from '@/lib/admin'

type PostRow = {
  id: string
  parent_post_id: string | null
  author_id: string
  content: string
  created_at: string
  updated_at: string
  users: { username: string } | null
  // Phase 3 additions:
  is_collapsed: boolean
  hold_state: 'none' | 'held' | 'released'
  hold_reasons: string[] | null
}

type PostNode = PostRow & { depth: number; children: PostNode[] }

function buildTree(posts: PostRow[]): PostNode[] {
  const byId = new Map<string, PostNode>()
  for (const p of posts) {
    byId.set(p.id, { ...p, depth: 0, children: [] })
  }
  const roots: PostNode[] = []
  for (const node of byId.values()) {
    if (node.parent_post_id && byId.has(node.parent_post_id)) {
      const parent = byId.get(node.parent_post_id)!
      node.depth = parent.depth + 1
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }
  // Sort each level by created_at ascending so conversation reads top-down.
  const sortTree = (nodes: PostNode[]) => {
    nodes.sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
    nodes.forEach((n) => sortTree(n.children))
  }
  sortTree(roots)
  return roots
}

type CommonProps = {
  currentUserId: string | null
  mutedIds: Set<string>
  category: string
  threadId: string
  blockedByThreadAuthor: boolean
  // Phase 3: map from postId to this user's own rating (if any).
  myRatings: Map<string, 'helpful' | 'unhelpful'>
  adminIds: Set<string>
}

function renderNode(node: PostNode, common: CommonProps) {
  return (
    <PostItem
      key={node.id}
      post={{
        id: node.id,
        content: node.content,
        created_at: node.created_at,
        updated_at: node.updated_at,
        author_id: node.author_id,
        author_username: getDisplayUsername(node.author_id, node.users?.username ?? 'unknown', common.adminIds),
        depth: node.depth,
        isCollapsed: node.is_collapsed,
        holdState: node.hold_state,
        holdReasons: node.hold_reasons,
      }}
      category={common.category}
      threadId={common.threadId}
      currentUserId={common.currentUserId}
      isMutedByMe={common.mutedIds.has(node.author_id)}
      myRating={common.myRatings.get(node.id) ?? null}
      canReply={
        !!common.currentUserId &&
        node.depth < MAX_REPLY_DEPTH &&
        !common.blockedByThreadAuthor
      }
      maxDepth={MAX_REPLY_DEPTH}
    >
      {node.children.length > 0 && (
        <ul className="mt-4 space-y-4 border-l border-stone-200 pl-4">
          {node.children.map((child) => (
            <li key={child.id}>{renderNode(child, common)}</li>
          ))}
        </ul>
      )}
    </PostItem>
  )
}

export default async function ThreadPage(
  props: PageProps<'/discuss/[category]/[threadId]'>
) {
  const { category, threadId } = await props.params
  const cat = getCategory(category)
  if (!cat) notFound()

  const supabase = await createClient()
  const adminIds = await getAdminUserIds()

  const { data: thread } = await supabase
    .from('threads')
    .select(
      'id, title, author_id, created_at, category, users:author_id(username)'
    )
    .eq('id', threadId)
    .eq('category', category)
    .maybeSingle<{
      id: string
      title: string
      author_id: string
      created_at: string
      category: string
      users: { username: string } | null
    }>()

  if (!thread) notFound()

  const { data: postRows } = await supabase
    .from('posts')
    .select(
      'id, parent_post_id, author_id, content, created_at, updated_at, is_collapsed, hold_state, hold_reasons, users:author_id(username)'
    )
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
    .returns<PostRow[]>()

  const rows = postRows ?? []
  const roots = buildTree(rows)

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/signin?next=/discuss/${category}/${threadId}`)

  // Fetch the set of users I have muted so the renderer can collapse their
  // posts. Blocks aren't needed here because RLS enforces them on insert.
  let mutedIds = new Set<string>()
  let blockedByThreadAuthor = false
  const myRatings = new Map<string, 'helpful' | 'unhelpful'>()
  if (user) {
    const { data: mutes } = await supabase
      .from('mutes')
      .select('muted_user_id')
      .eq('user_id', user.id)
    mutedIds = new Set((mutes ?? []).map((m) => m.muted_user_id))

    if (thread.author_id !== user.id) {
      const { data: blocked } = await supabase.rpc('is_blocked_by', {
        target: thread.author_id,
      })
      blockedByThreadAuthor = blocked === true
    }

    // Phase 3: fetch this user's own ratings for the posts in this thread
    // so the RatingButtons can show the checkmark state. RLS "ratings:
    // read own" limits the select to auth.uid = user_id, so no other
    // user's votes are exposed.
    if (rows.length > 0) {
      const postIds = rows.map((r) => r.id)
      const { data: ratingRows } = await supabase
        .from('ratings')
        .select('content_id, rating')
        .eq('user_id', user.id)
        .eq('content_type', 'post')
        .in('content_id', postIds)
      for (const r of ratingRows ?? []) {
        myRatings.set(
          r.content_id as string,
          r.rating as 'helpful' | 'unhelpful'
        )
      }
    }
  }

  const common: CommonProps = {
    currentUserId: user?.id ?? null,
    mutedIds,
    category,
    threadId,
    blockedByThreadAuthor,
    myRatings,
    adminIds,
  }

  return (
    <>
      <DiscussHeader />
      <main className="flex-1 px-6 py-12">
        <div className="mx-auto max-w-2xl">
          <p className="text-sm text-stone-500">
            <Link
              href={`/discuss/${category}`}
              className="underline hover:text-stone-900"
            >
              ← {cat.name}
            </Link>
          </p>
          <h1 className="mt-1 text-2xl font-semibold">{thread.title}</h1>

          {roots.length === 0 && (
            <p className="mt-8 text-sm text-stone-500">
              This thread has no posts. It was probably deleted.
            </p>
          )}

          <ul className="mt-6 space-y-6">
            {roots.map((node) => (
              <li key={node.id}>{renderNode(node, common)}</li>
            ))}
          </ul>

          {user && !blockedByThreadAuthor && (
            <div className="mt-12 border-t border-stone-200 pt-6">
              <h2 className="text-sm font-medium text-stone-700">
                Add a top-level reply
              </h2>
              <RootReplyForm threadId={threadId} category={category} />
            </div>
          )}

          {user && blockedByThreadAuthor && (
            <p className="mt-12 border-t border-stone-200 pt-6 text-sm text-stone-500">
              You cannot reply to this thread.
            </p>
          )}

        </div>
      </main>
      <SiteFooter />
    </>
  )
}
