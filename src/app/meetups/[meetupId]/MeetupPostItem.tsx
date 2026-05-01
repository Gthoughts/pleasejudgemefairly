'use client'

import { ReactNode, useState } from 'react'
import { usePathname } from 'next/navigation'
import { formatWhen } from '@/lib/format'
import {
  createMeetupReplyAction,
  editMeetupPostAction,
  deleteMeetupPostAction,
  flagMeetupPostAction,
} from '../actions'
import {
  muteUserAction,
  unmuteUserAction,
  blockUserAction,
} from '@/app/discuss/actions'
import MeetupRatingButtons from './MeetupRatingButtons'
import { MAX_REPLY_DEPTH } from '@/lib/discuss'

type PostView = {
  id: string
  content: string
  created_at: string
  updated_at: string
  author_id: string
  author_username: string
  depth: number
  isPinned?: boolean
  isCollapsed?: boolean
  holdState?: 'none' | 'held' | 'released'
  holdReasons?: string[] | null
}

type Props = {
  post: PostView
  meetupId: string
  currentUserId: string | null
  isMutedByMe: boolean
  canReply: boolean
  myRating?: 'helpful' | 'unhelpful' | null
  children?: ReactNode
}

export default function MeetupPostItem({
  post,
  meetupId,
  currentUserId,
  isMutedByMe,
  canReply,
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
  const isPinned = post.isPinned === true

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
    <article
      className={`rounded border px-4 py-3 ${
        isPinned
          ? 'border-stone-400 bg-stone-50'
          : 'border-stone-200 bg-white'
      }`}
    >
      {isPinned && (
        <div className="mb-2 text-xs font-medium text-stone-500 uppercase tracking-wide">
          Organiser announcement
        </div>
      )}
      {isHeld && (
        <div
          role="note"
          className="mb-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900"
        >
          <span className="font-medium">Held for review.</span>{' '}
          The automatic filter matched this post.
          {post.holdReasons && post.holdReasons.length > 0 && (
            <span className="ml-1 text-amber-800">({post.holdReasons.join(', ')})</span>
          )}
        </div>
      )}

      <header className="flex flex-wrap items-baseline gap-x-2 text-sm text-stone-500">
        <span className="font-medium text-stone-800">{post.author_username}</span>
        <span>·</span>
        <time dateTime={post.created_at}>{formatWhen(post.created_at)}</time>
        {edited && <span className="text-stone-400">· edited</span>}
      </header>

      {mode === 'editing' ? (
        <form action={editMeetupPostAction} className="mt-3 flex flex-col gap-2">
          <input type="hidden" name="post_id" value={post.id} />
          <input type="hidden" name="meetup_id" value={meetupId} />
          <textarea
            name="content"
            defaultValue={post.content}
            required
            minLength={1}
            maxLength={20000}
            rows={6}
            className="rounded border border-stone-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
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
        <div className="mt-2 whitespace-pre-wrap text-stone-800">{post.content}</div>
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
              <form action={deleteMeetupPostAction} className="inline">
                <input type="hidden" name="post_id" value={post.id} />
                <input type="hidden" name="meetup_id" value={meetupId} />
                <button
                  type="submit"
                  className="text-stone-600 hover:text-red-700 hover:underline"
                  onClick={(e) => {
                    if (!confirm('Delete this post?')) e.preventDefault()
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
                <input type="hidden" name="target_user_id" value={post.author_id} />
                <input type="hidden" name="redirect_to" value={pathname} />
                <button
                  type="submit"
                  className="text-stone-500 hover:text-stone-800 hover:underline"
                >
                  Mute
                </button>
              </form>
              <form action={blockUserAction} className="inline">
                <input type="hidden" name="target_user_id" value={post.author_id} />
                <input type="hidden" name="redirect_to" value={pathname} />
                <button
                  type="submit"
                  className="text-stone-500 hover:text-stone-800 hover:underline"
                  onClick={(e) => {
                    if (!confirm(`Block ${post.author_username}?`)) e.preventDefault()
                  }}
                >
                  Block
                </button>
              </form>
            </>
          )}

          {isMutedByMe && showHiddenMuted && (
            <form action={unmuteUserAction} className="inline">
              <input type="hidden" name="target_user_id" value={post.author_id} />
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
            <form action={flagMeetupPostAction} className="inline">
              <input type="hidden" name="post_id" value={post.id} />
              <input type="hidden" name="meetup_id" value={meetupId} />
              <input type="hidden" name="reason" value="user_report" />
              <button
                type="submit"
                className="text-stone-500 hover:text-stone-800 hover:underline"
                onClick={(e) => {
                  if (!confirm('Flag this post for review?')) e.preventDefault()
                }}
              >
                Flag
              </button>
            </form>
          )}

          {post.depth >= MAX_REPLY_DEPTH && (
            <span className="text-stone-400 text-xs">(max reply depth reached)</span>
          )}
        </div>
      )}

      {mode !== 'editing' && isSignedIn && (
        <div className="mt-3">
          <MeetupRatingButtons
            postId={post.id}
            meetupId={meetupId}
            initialRating={myRating}
          />
        </div>
      )}

      {mode === 'replying' && (
        <form action={createMeetupReplyAction} className="mt-3 flex flex-col gap-2">
          <input type="hidden" name="meetup_id" value={meetupId} />
          <input type="hidden" name="parent_post_id" value={post.id} />
          <textarea
            name="content"
            required
            minLength={1}
            maxLength={20000}
            rows={4}
            placeholder="Write a reply"
            className="rounded border border-stone-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
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
