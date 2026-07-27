'use client'

import { ReactNode, useState } from 'react'
import { formatWhen } from '@/lib/format'
import {
  createUserProjectReplyAction,
  editUserProjectPostAction,
  deleteUserProjectPostAction,
} from '../../actions'
import PendingSubmitButton from '@/components/PendingSubmitButton'
import PostContent from '@/components/PostContent'
import { MAX_REPLY_DEPTH } from '@/lib/discuss'

type PostView = {
  id: string
  content: string
  author_id: string
  created_at: string
  hold_state: string
  author: { username: string } | null
}

type Mode = 'view' | 'editing' | 'replying'

export default function UserProjectPostItem({
  post,
  userProjectId,
  depth,
  currentUserId,
  children,
}: {
  post: PostView
  userProjectId: string
  depth: number
  currentUserId: string | null
  children?: ReactNode
}) {
  const [mode, setMode] = useState<Mode>('view')

  const isAuthor = currentUserId !== null && currentUserId === post.author_id
  const canReply = currentUserId !== null && depth < MAX_REPLY_DEPTH
  const isHeld = post.hold_state === 'held'

  return (
    <article
      className={
        'py-3 ' +
        (depth > 0 ? 'border-l border-stone-200 pl-4 sm:pl-5' : '')
      }
    >
      {isHeld && (
        <p className="mb-2 rounded border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-900">
          Held for review — matched the automatic filter.
        </p>
      )}

      <p className="text-xs text-stone-500">
        <span className="font-medium text-stone-700">
          {post.author?.username ?? 'unknown'}
        </span>
        <span className="mx-1">·</span>
        <time dateTime={post.created_at}>{formatWhen(post.created_at)}</time>
      </p>

      {mode === 'editing' ? (
        <form
          action={async (formData) => {
            await editUserProjectPostAction(formData)
            setMode('view')
          }}
          className="mt-2 flex flex-col gap-2"
        >
          <input type="hidden" name="post_id" value={post.id} />
          <input type="hidden" name="user_project_id" value={userProjectId} />
          <textarea
            name="content"
            required
            minLength={1}
            maxLength={20000}
            rows={4}
            defaultValue={post.content}
            className="rounded border border-stone-300 px-3 py-2 text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
          />
          <div className="flex items-center gap-3">
            <PendingSubmitButton
              idle="Save"
              pending="Saving…"
              className="inline-flex items-center gap-2 rounded bg-stone-900 text-stone-50 px-3 py-1.5 text-sm hover:bg-stone-700 disabled:cursor-wait disabled:bg-stone-500"
            />
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
        <PostContent content={post.content} />
      )}

      {mode !== 'editing' && (
        <div className="mt-2 flex items-center gap-x-4 gap-y-1 text-xs">
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
              <form
                action={async (formData) => {
                  if (!confirm('Delete this post? This cannot be undone.'))
                    return
                  await deleteUserProjectPostAction(formData)
                }}
                className="inline"
              >
                <input type="hidden" name="post_id" value={post.id} />
                <input
                  type="hidden"
                  name="user_project_id"
                  value={userProjectId}
                />
                <button
                  type="submit"
                  className="text-stone-600 hover:text-red-700 hover:underline"
                >
                  Delete
                </button>
              </form>
            </>
          )}
        </div>
      )}

      {mode === 'replying' && (
        <form
          action={async (formData) => {
            await createUserProjectReplyAction(formData)
            setMode('view')
          }}
          className="mt-3 flex flex-col gap-2"
        >
          <input type="hidden" name="user_project_id" value={userProjectId} />
          <input type="hidden" name="parent_post_id" value={post.id} />
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
            <PendingSubmitButton
              idle="Post reply"
              pending="Posting…"
              className="inline-flex items-center gap-2 rounded bg-stone-900 text-stone-50 px-3 py-1.5 text-sm hover:bg-stone-700 disabled:cursor-wait disabled:bg-stone-500"
            />
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
