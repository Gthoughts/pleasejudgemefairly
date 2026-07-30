'use client'

import { useState } from 'react'
import { createVideoCommentAction } from '../actions'

export default function NewCommentForm({ videoId }: { videoId: string }) {
  const [content, setContent] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.set('video_id', videoId)
      fd.set('content', content.trim())
      await createVideoCommentAction(fd)
      setContent('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Post failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value.slice(0, 20000))}
        rows={3}
        placeholder="Start or join a conversation about this video"
        className="w-full rounded border border-stone-300 p-2 text-sm"
      />
      {error ? (
        <div className="rounded bg-red-50 p-2 text-xs text-red-800">
          {error}
        </div>
      ) : null}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={busy || content.trim().length === 0}
          className="rounded bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
        >
          {busy ? 'Posting…' : 'Post'}
        </button>
      </div>
    </form>
  )
}
