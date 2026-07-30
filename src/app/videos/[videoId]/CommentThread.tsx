'use client'

import { useState } from 'react'
import { formatWhen } from '@/lib/format'
import type { VideoComment } from '@/lib/videos/queries'
import {
  rateVideoCommentAction,
  replyToVideoCommentAction,
} from '../actions'

// Renders the flat list of video comments as a nested tree. Each
// node has a compact rating pair (helpful / unhelpful) and a Reply
// affordance that opens a small inline composer. Depth is capped by
// the server; we let the caller decide the max render depth (default
// unlimited within a video, matches phase18 pattern).

type Node = VideoComment & { children: Node[] }

function buildTree(rows: VideoComment[]): Node[] {
  const byId = new Map<string, Node>()
  for (const r of rows) byId.set(r.id, { ...r, children: [] })
  const roots: Node[] = []
  for (const r of rows) {
    const node = byId.get(r.id)!
    if (r.parent_post_id && byId.has(r.parent_post_id)) {
      byId.get(r.parent_post_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

export default function CommentThread({
  videoId,
  comments,
  currentUserId,
}: {
  videoId: string
  comments: VideoComment[]
  currentUserId: string | null
}) {
  const tree = buildTree(comments)
  if (tree.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-stone-500">
        No comments yet. Start the conversation.
      </div>
    )
  }
  return (
    <ul className="divide-y divide-stone-100">
      {tree.map((n) => (
        <CommentNode
          key={n.id}
          node={n}
          videoId={videoId}
          currentUserId={currentUserId}
        />
      ))}
    </ul>
  )
}

function CommentNode({
  node,
  videoId,
  currentUserId,
  depth = 0,
}: {
  node: Node
  videoId: string
  currentUserId: string | null
  depth?: number
}) {
  const [replying, setReplying] = useState(false)
  const [replyContent, setReplyContent] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function rate(rating: 'helpful' | 'unhelpful' | '') {
    if (!currentUserId) return
    try {
      const fd = new FormData()
      fd.set('video_id', videoId)
      fd.set('post_id', node.id)
      fd.set('rating', rating)
      await rateVideoCommentAction(fd)
    } catch {
      // silent
    }
  }

  async function submitReply(e: React.FormEvent) {
    e.preventDefault()
    if (busy || replyContent.trim().length === 0) return
    setBusy(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.set('video_id', videoId)
      fd.set('parent_post_id', node.id)
      fd.set('content', replyContent.trim())
      await replyToVideoCommentAction(fd)
      setReplyContent('')
      setReplying(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reply failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="py-3" style={{ paddingLeft: depth * 14 }}>
      <div className="flex items-baseline justify-between gap-2 text-xs text-stone-500">
        <span className="font-medium text-stone-700">
          {node.author_username}
        </span>
        <span>{formatWhen(node.created_at)}</span>
      </div>
      <div className="mt-1 whitespace-pre-wrap text-sm text-stone-900">
        {node.content}
      </div>
      <div className="mt-1 flex items-center gap-3 text-xs text-stone-500">
        <button
          type="button"
          onClick={() => rate('helpful')}
          disabled={!currentUserId}
          className="hover:text-emerald-700 disabled:opacity-50"
        >
          helpful
        </button>
        <button
          type="button"
          onClick={() => rate('unhelpful')}
          disabled={!currentUserId}
          className="hover:text-stone-800 disabled:opacity-50"
        >
          unhelpful
        </button>
        {currentUserId ? (
          <button
            type="button"
            onClick={() => setReplying((x) => !x)}
            className="hover:text-stone-800"
          >
            {replying ? 'cancel' : 'reply'}
          </button>
        ) : null}
      </div>
      {replying ? (
        <form onSubmit={submitReply} className="mt-2 space-y-2">
          <textarea
            value={replyContent}
            onChange={(e) =>
              setReplyContent(e.target.value.slice(0, 20000))
            }
            rows={2}
            className="w-full rounded border border-stone-300 p-2 text-xs"
            placeholder="Your reply"
          />
          {error ? (
            <div className="rounded bg-red-50 p-1.5 text-xs text-red-800">
              {error}
            </div>
          ) : null}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={busy || replyContent.trim().length === 0}
              className="rounded bg-stone-900 px-2 py-1 text-xs font-medium text-white hover:bg-stone-800 disabled:opacity-50"
            >
              {busy ? 'Posting…' : 'Reply'}
            </button>
          </div>
        </form>
      ) : null}
      {node.children.length > 0 ? (
        <ul className="mt-2 border-l border-stone-200 pl-2">
          {node.children.map((c) => (
            <CommentNode
              key={c.id}
              node={c}
              videoId={videoId}
              currentUserId={currentUserId}
              depth={depth + 1}
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}
