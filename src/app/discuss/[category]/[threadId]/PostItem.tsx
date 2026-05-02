'use client'

import { ReactNode, useState } from 'react'
import { usePathname } from 'next/navigation'
import { formatWhen } from '@/lib/format'
import {
  createReplyAction,
  editPostAction,
  deletePostAction,
  muteUserAction,
  unmuteUserAction,
  blockUserAction,
  flagPostAction,
} from '../../actions'
import RatingButtons from './RatingButtons'

type PostView = {
  id: string
  content: string
  created_at: string
  updated_at: string
  author_id: string
  author_username: string
  depth: number
  // Phase 3 additions (optional so old call sites still type-check):
  isCollapsed?: boolean
  holdState?: 'none' | 'held' | 'released'
  holdReasons?: string[] | null
}

type Props = {
  post: PostView
  category: string
  threadId: string
  currentUserId: string | null
  isMutedByMe: boolean
  canReply: boolean
  maxDepth: number
  // Phase 3: current user's own rating for this post (if any).
  myRating?: 'helpful' | 'unhelpful' | null
  children?: ReactNode
}

// A single post in the thread tree. Handles three interactive states
// locally: viewing, replying (a textarea below the post), and editing
// (a textarea in place of the content). Mute and block are submitted as
// small forms that hit server actions.
export default function PostItem({
  post,
  category,
  threadId,
  currentUserId,
  isMutedByMe,
  canReply,
  maxDepth,
  myRating = null,
  children,
}: Props) {
  const pathname = usePathname()
  const [mode, setMode] = useState<'view' | 'editing' | 'replying'>('view')
  const [showHiddenMuted, setShowHiddenMuted] = useState(false)
  const [showCollapsed, setShowCollapsed] = useState(false)
  const isAuthor = currentUserId !== null && currentUserId === post.author_id
  const isSignedIn = currentUserId !== null
  const edited = post.updated_at !== post.created_at
  const isCollapsed = post.isCollapsed === true
  const isHeld = post.holdState === 'held'

  // Priority order for collapsed rendering:
  //   1. Muted by me  -> always wins; I chose to hide this user.
  //   2. Collapsed by community -> show placeholder with "show this post".
  //   3. Otherwise render normally. Held posts are rendered normally but
  //      with a banner on top.
  if (isMutedByMe && !showHiddenMuted) {
    return (
      <div className="rounded border border-dashed border-stone-300 bg-stone-50 px-4 py-3 text-sm text-stone-500">
        post hidden ({post.author_username} is muted){' '}
        <button
          type="button"
          onClick={() => setShowHiddenMuted(true)}
          className="underline hover:text-stone-800"
        >
          show this post
        </button>
        {children}
      </div>
    )
  }

  if (isCollapsed && !showCollapsed) {
    return (
      <div className="rounded border border-dashed border-stone-300 bg-stone-50 px-4 py-3 text-sm text-stone-500">
        post collapsed by community &middot;{' '}
        <button
          type="button"
          onClick={() => setShowCollapsed(true)}
          className="underline hover:text-stone-800"
        >
          show this post
        </button>
        {children}
      </div>
    )
  }

  return (
    <article className="rounded border border-stone-200 bg-white px-4 py-3">
      {isHeld && (
        <div
          role="note"
          className="mb-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900"
        >
          <span className="font-medium">Held for review.</span>{' '}
          The automatic filter matched this post against the
          no-money-making rule. It is visible while the community
          decides. It may be removed if flagged.
          {post.holdReasons && post.holdReasons.length > 0 && (
            <span className="ml-1 text-amber-800">
              ({post.holdReasons.join(', ')})
            </span>
          )}
        </div>
      )}
      <header className="flex flex-wrap items-baseline gap-x-2 text-sm text-stone-500">
        <span className="font-medium text-stone-800">
          {post.author_username}
        </span>
        <span>·</span>
        <time dateTime={post.created_at}>{formatWhen(post.created_at)}</time>
        {edited && <span className="text-stone-400">· edited</span>}
      </header>

      {mode === 'editing' ? (
        <form action={editPostAction} className="mt-3 flex flex-col gap-2">
          <input type="hidden" name="post_id" value={post.id} />
          <input type="hidden" name="thread_id" value={threadId} />
          <input type="hidden" name="category" value={category} />
          <textarea
            name="content"
            defaultValue={post.content}
            required
            minLength={1}
            maxLength={20000}
            rows={6}
            className="rounded border border-stone-300 px-3 py-2 text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
          />
          <div className="flex items-center gap-3">
            <button
              type="submit"
              onClick={() => setMode('view')}
              className="rounded bg-stone-900 text-stone-50 px-3 py-1.5 text-sm hover:bg-stone-700"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setMode('view')}
              className="text-sm text-stone-600 hover:underline"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-2 whitespace-pre-wrap text-stone-800">
          {post.content}
        </div>
      )}

      {mode !== 'editing' && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          {canReply && mode !== 'replying' && (
            <button
              type="button"
              onClick={() => setMode('replying')}
              className="text-stone-600 hover:text-stone-900 hover:underline"
            >
              Reply
            </button>
          )}

          {isAuthor && (
            <>
              <button
                type="button"
                onClick={() => setMode('editing')}
                className="text-stone-600 hover:text-stone-900 hover:underline"
              >
                Edit
              </button>
              <form action={deletePostAction} className="inline">
                <input type="hidden" name="post_id" value={post.id} />
                <input type="hidden" name="thread_id" value={threadId} />
                <input type="hidden" name="category" value={category} />
                <button
                  type="submit"
                  className="text-stone-600 hover:text-red-700 hover:underline"
                  onClick={(e) => {
                    if (
                      !confirm(
                        'Delete this post? If it is the top of the thread, the whole thread is deleted.'
                      )
                    ) {
                      e.preventDefault()
                    }
                  }}
                >
                  Delete
                </button>
              </form>
            </>
          )}

          {isSignedIn && !isAuthor && (
            <>
              <form action={muteUserAction} className="inline">
                <input
                  type="hidden"
                  name="target_user_id"
                  value={post.author_id}
                />
                <input type="hidden" name="redirect_to" value={pathname} />
                <button
                  type="submit"
                  className="text-stone-500 hover:text-stone-800 hover:underline"
                >
                  Mute
                </button>
              </form>
              <form action={blockUserAction} className="inline">
                <input
                  type="hidden"
                  name="target_user_id"
                  value={post.author_id}
                />
                <input type="hidden" name="redirect_to" value={pathname} />
                <button
                  type="submit"
                  className="text-stone-500 hover:text-stone-800 hover:underline"
                  onClick={(e) => {
                    if (
                      !confirm(
                        `Block ${post.author_username}? They will not be able to reply to your threads.`
                      )
                    ) {
                      e.preventDefault()
                    }
                  }}
                >
                  Block
                </button>
              </form>
            </>
          )}

          {isMutedByMe && showHiddenMuted && (
            <form action={unmuteUserAction} className="inline">
              <input
                type="hidden"
                name="target_user_id"
                value={post.author_id}
              />
              <input type="hidden" name="redirect_to" value={pathname} />
              <button
                type="submit"
                className="text-stone-500 hover:text-stone-800 hover:underline"
              >
                Unmute
              </button>
            </form>
          )}

          {isSignedIn && !isAuthor && (
            <form action={flagPostAction} className="inline">
              <input type="hidden" name="post_id" value={post.id} />
              <input type="hidden" name="reason" value="user_report" />
              <input type="hidden" name="redirect_to" value={pathname} />
              <button
                type="submit"
                className="text-stone-500 hover:text-stone-800 hover:underline"
                onClick={(e) => {
                  if (
                    !confirm(
                      'Flag this post for review? Flags are public to the author of the thread, not to you.'
                    )
                  ) {
                    e.preventDefault()
                  }
                }}
              >
                Flag
              </button>
            </form>
          )}

          {post.depth >= maxDepth && (
            <span className="text-stone-400 text-xs">
              (max reply depth reached)
            </span>
          )}
        </div>
      )}

      {/*
        Cross-perspective rating row. Signed-out users see nothing
        here; signed-in users see two quiet buttons with a checkmark
        on whichever one they chose. No counts, no scores, no totals
        are ever rendered.
      */}
      {mode !== 'editing' && isSignedIn && (
        <div className="mt-3">
          <RatingButtons
            postId={post.id}
            initialRating={myRating}
            redirectTo={pathname}
          />
        </div>
      )}

      {mode === 'replying' && (
        <form
          action={createReplyAction}
          className="mt-3 flex flex-col gap-2"
        >
          <input type="hidden" name="thread_id" value={threadId} />
          <input type="hidden" name="parent_post_id" value={post.id} />
          <input type="hidden" name="category" value={category} />
          <textarea
            name="content"
            required
            minLength={1}
            maxLength={20000}
            rows={4}
            placeholder="Write a reply"
            className="rounded border border-stone-300 px-3 py-2 text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
          />
          <div className="flex items-center gap-3">
            <button
              type="submit"
              onClick={() => setMode('view')}
              className="rounded bg-stone-900 text-stone-50 px-3 py-1.5 text-sm hover:bg-stone-700"
            >
              Post reply
            </button>
            <button
              type="button"
              onClick={() => setMode('view')}
              className="text-sm text-stone-600 hover:underline"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {children}
    </article>
  )
}
