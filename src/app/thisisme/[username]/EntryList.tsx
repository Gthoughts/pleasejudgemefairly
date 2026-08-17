'use client'

import { useState } from 'react'
import { detectEmbed, embedIframeUrl } from '@/lib/media-embeds'
import { createClient } from '@/lib/supabase/client'
import type { Entry, CommentRow } from '@/lib/this-is-me/queries'
import {
  toggleLoveAction,
  deleteEntryAction,
  editEntryTextAction,
  toggleCommentsEnabledAction,
  addCommentAction,
  deleteCommentAction,
} from '../actions'

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

// Signed URL for a photo stored under the user's folder in Supabase
// Storage. Public bucket, so we just build the public URL.
function photoUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  return `${base}/storage/v1/object/public/this-is-me-photos/${path}`
}

type Props = {
  entries: Entry[]
  isOwner: boolean
  currentUserId: string
  username: string
  myLovedIds: string[]
  commentsByEntry: Record<string, CommentRow[]>
}

export default function EntryList(props: Props) {
  const { entries, isOwner, currentUserId, username, myLovedIds, commentsByEntry } = props
  const lovedSet = new Set(myLovedIds)

  if (entries.length === 0 && !isOwner) {
    return (
      <p className="text-sm text-stone-500">
        {username} hasn&rsquo;t written anything here yet.
      </p>
    )
  }
  if (entries.length === 0) return null

  return (
    <ul className="space-y-8">
      {entries.map((e) => (
        <EntryItem
          key={e.id}
          entry={e}
          isOwner={isOwner}
          currentUserId={currentUserId}
          username={username}
          myLoved={lovedSet.has(e.id)}
          comments={commentsByEntry[e.id] ?? []}
        />
      ))}
    </ul>
  )
}

function EntryItem({
  entry,
  isOwner,
  currentUserId,
  username,
  myLoved,
  comments,
}: {
  entry: Entry
  isOwner: boolean
  currentUserId: string
  username: string
  myLoved: boolean
  comments: CommentRow[]
}) {
  const [editing, setEditing] = useState(false)
  const [flashLoved, setFlashLoved] = useState(false)

  return (
    <li className="border border-stone-200 rounded p-4">
      <p className="text-xs text-stone-400">{formatWhen(entry.created_at)}</p>

      <div className="mt-2">
        {entry.entry_type === 'text' ? (
          editing ? (
            <form
              action={async (fd) => {
                await editEntryTextAction(fd)
                setEditing(false)
              }}
              className="space-y-2"
            >
              <input type="hidden" name="entry_id" value={entry.id} />
              <input type="hidden" name="username" value={username} />
              <textarea
                name="content"
                defaultValue={entry.content ?? ''}
                rows={6}
                required
                maxLength={20000}
                className="w-full rounded border border-stone-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="rounded bg-stone-900 text-stone-50 px-3 py-1.5 text-xs hover:bg-stone-700"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="rounded border border-stone-300 px-3 py-1.5 text-xs text-stone-600 hover:border-stone-500"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <p className="whitespace-pre-wrap text-sm text-stone-800 leading-relaxed">
              {entry.content}
            </p>
          )
        ) : null}

        {entry.entry_type === 'photo' && entry.media_url ? (
          <>
            <img
              src={photoUrl(entry.media_url)}
              alt={entry.content ?? ''}
              className="max-h-[70vh] w-full object-contain rounded bg-stone-100"
            />
            {entry.content ? (
              <p className="mt-2 text-sm text-stone-600 italic">{entry.content}</p>
            ) : null}
          </>
        ) : null}

        {entry.entry_type === 'video' && entry.media_url ? (
          <>
            <VideoBlock url={entry.media_url} />
            {entry.content ? (
              <p className="mt-2 text-sm text-stone-600 italic">{entry.content}</p>
            ) : null}
          </>
        ) : null}
      </div>

      {/* Love button (any non-owner signed-in user) + owner controls */}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {!isOwner && (
          <form
            action={async (fd) => {
              await toggleLoveAction(fd)
              // brief pulse
              setFlashLoved(true)
              setTimeout(() => setFlashLoved(false), 900)
            }}
          >
            <input type="hidden" name="entry_id" value={entry.id} />
            <input type="hidden" name="username" value={username} />
            <input type="hidden" name="loved" value={myLoved ? 'true' : 'false'} />
            <button
              type="submit"
              aria-label={myLoved ? 'Unlove this entry' : 'Love this entry'}
              className={
                'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition ' +
                (myLoved || flashLoved
                  ? 'border-rose-400 bg-rose-50 text-rose-600 scale-110'
                  : 'border-stone-300 text-stone-500 hover:border-rose-300 hover:text-rose-500')
              }
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill={myLoved || flashLoved ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6.5 5.5 5.5 0 0 1 21.5 12c-2.5 4.5-9.5 9-9.5 9z" />
              </svg>
            </button>
          </form>
        )}

        {isOwner && (
          <>
            {entry.entry_type === 'text' && !editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-xs text-stone-500 underline hover:text-stone-800"
              >
                Edit
              </button>
            )}
            <form action={toggleCommentsEnabledAction}>
              <input type="hidden" name="entry_id" value={entry.id} />
              <input type="hidden" name="username" value={username} />
              <input
                type="hidden"
                name="enabled"
                value={entry.comments_enabled ? 'false' : 'true'}
              />
              <button
                type="submit"
                className="text-xs text-stone-500 underline hover:text-stone-800"
              >
                {entry.comments_enabled
                  ? 'Close feedback'
                  : 'Ask for feedback'}
              </button>
            </form>
            <form action={deleteEntryAction} className="ml-auto">
              <input type="hidden" name="entry_id" value={entry.id} />
              <input type="hidden" name="username" value={username} />
              <button
                type="submit"
                className="text-xs text-stone-400 underline hover:text-red-700"
                onClick={(e) => {
                  if (!confirm('Delete this entry?')) e.preventDefault()
                }}
              >
                Delete
              </button>
            </form>
          </>
        )}
      </div>

      {/* Comments — always show if any exist. Add-comment box only if
          the poster has opted in or the commenter IS the poster. */}
      {(comments.length > 0 || entry.comments_enabled || isOwner) && (
        <CommentBlock
          entry={entry}
          isOwner={isOwner}
          currentUserId={currentUserId}
          username={username}
          comments={comments}
        />
      )}
    </li>
  )
}

function VideoBlock({ url }: { url: string }) {
  const info = detectEmbed(url)
  if (!info) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="text-sm text-stone-600 underline hover:text-stone-900"
      >
        {url}
      </a>
    )
  }
  return (
    <div className="aspect-video w-full overflow-hidden rounded border border-stone-800 bg-black">
      <iframe
        src={embedIframeUrl(info)}
        title="Video"
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="h-full w-full"
      />
    </div>
  )
}

function CommentBlock({
  entry,
  isOwner,
  currentUserId,
  username,
  comments,
}: {
  entry: Entry
  isOwner: boolean
  currentUserId: string
  username: string
  comments: CommentRow[]
}) {
  const canAdd = entry.comments_enabled || isOwner
  return (
    <div className="mt-4 border-t border-stone-200 pt-3">
      {entry.comments_enabled && (
        <p className="text-xs text-stone-500 mb-2">
          The poster has asked for feedback on this entry.
        </p>
      )}
      {comments.length > 0 && (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="text-sm">
              <div className="flex items-baseline gap-2">
                <span className="font-medium text-stone-700">
                  {c.users?.username ?? 'unknown'}
                </span>
                <span className="text-xs text-stone-400">
                  {new Date(c.created_at).toLocaleString('en-GB', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </span>
                {c.author_id === currentUserId && (
                  <form action={deleteCommentAction} className="ml-auto">
                    <input type="hidden" name="comment_id" value={c.id} />
                    <input type="hidden" name="username" value={username} />
                    <button
                      type="submit"
                      className="text-xs text-stone-400 underline hover:text-red-700"
                      onClick={(e) => {
                        if (!confirm('Delete this comment?')) e.preventDefault()
                      }}
                    >
                      Delete
                    </button>
                  </form>
                )}
              </div>
              <p className="mt-0.5 whitespace-pre-wrap text-stone-800">
                {c.content}
              </p>
            </li>
          ))}
        </ul>
      )}
      {canAdd && (
        <form action={addCommentAction} className="mt-3 flex flex-col gap-2">
          <input type="hidden" name="entry_id" value={entry.id} />
          <input type="hidden" name="username" value={username} />
          <textarea
            name="content"
            required
            maxLength={10000}
            rows={2}
            placeholder={isOwner ? 'Add a note…' : 'Leave feedback…'}
            className="rounded border border-stone-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
          />
          <div>
            <button
              type="submit"
              className="rounded bg-stone-900 text-stone-50 px-3 py-1.5 text-xs hover:bg-stone-700"
            >
              Post
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

// Unused import removed by build; imported here so createClient stays
// available if we later switch photo/video uploads to happen inside
// this component. Not called at runtime.
void createClient
