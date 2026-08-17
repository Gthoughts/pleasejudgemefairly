'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  addTextEntryAction,
  addPhotoEntryAction,
  addVideoEntryAction,
} from '../actions'

type Mode = null | 'text' | 'photo' | 'video'

export default function AddEntryDialog({
  username,
  onClose,
}: {
  username: string
  onClose: () => void
}) {
  const [mode, setMode] = useState<Mode>(null)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold">
            {mode === null ? 'Add to your story' : titleFor(mode)}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-800 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {mode === null && (
          <div className="mt-4 grid gap-2">
            <ChoiceButton onClick={() => setMode('text')}>
              Write text
            </ChoiceButton>
            <ChoiceButton onClick={() => setMode('photo')}>
              Upload a photo
            </ChoiceButton>
            <ChoiceButton onClick={() => setMode('video')}>
              Share a video link
            </ChoiceButton>
          </div>
        )}

        {mode === 'text' && (
          <TextForm username={username} onDone={onClose} />
        )}
        {mode === 'photo' && (
          <PhotoForm username={username} onDone={onClose} />
        )}
        {mode === 'video' && (
          <VideoForm username={username} onDone={onClose} />
        )}
      </div>
    </div>
  )
}

function titleFor(mode: Exclude<Mode, null>): string {
  return {
    text: 'Write text',
    photo: 'Upload a photo',
    video: 'Share a video link',
  }[mode]
}

function ChoiceButton({
  onClick,
  children,
}: {
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded border border-stone-300 px-3 py-3 text-sm text-stone-800 hover:border-stone-500 hover:bg-stone-50 text-left"
    >
      {children}
    </button>
  )
}

function TextForm({ username, onDone }: { username: string; onDone: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        setSubmitting(true)
        setError(null)
        try {
          await addTextEntryAction(new FormData(e.currentTarget))
          onDone()
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Something went wrong.')
          setSubmitting(false)
        }
      }}
      className="mt-4 flex flex-col gap-3"
    >
      <input type="hidden" name="username" value={username} />
      <textarea
        name="content"
        required
        maxLength={20000}
        rows={8}
        placeholder="Write whatever you feel comfortable sharing…"
        className="rounded border border-stone-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
      />
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div>
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-stone-900 text-stone-50 px-4 py-2 text-sm hover:bg-stone-700 disabled:opacity-60"
        >
          {submitting ? 'Adding…' : 'Add entry'}
        </button>
      </div>
    </form>
  )
}

function PhotoForm({
  username,
  onDone,
}: {
  username: string
  onDone: () => void
}) {
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const file = fileRef.current?.files?.[0]
      if (!file) throw new Error('Please choose a photo.')
      if (file.size > 15 * 1024 * 1024) throw new Error('Photo must be under 15MB.')

      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Session expired — please refresh and sign in.')

      const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase()
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('this-is-me-photos')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || undefined,
        })
      if (upErr) throw new Error(upErr.message)

      const fd = new FormData(e.currentTarget)
      fd.set('media_url', path)
      await addPhotoEntryAction(fd)
      router.refresh()
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
      <input type="hidden" name="username" value={username} />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        required
        className="text-sm"
      />
      <textarea
        name="content"
        maxLength={20000}
        rows={3}
        placeholder="Caption (optional)"
        className="rounded border border-stone-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
      />
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div>
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-stone-900 text-stone-50 px-4 py-2 text-sm hover:bg-stone-700 disabled:opacity-60"
        >
          {submitting ? 'Uploading…' : 'Add entry'}
        </button>
      </div>
    </form>
  )
}

function VideoForm({
  username,
  onDone,
}: {
  username: string
  onDone: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        setSubmitting(true)
        setError(null)
        try {
          await addVideoEntryAction(new FormData(e.currentTarget))
          onDone()
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Something went wrong.')
          setSubmitting(false)
        }
      }}
      className="mt-4 flex flex-col gap-3"
    >
      <input type="hidden" name="username" value={username} />
      <input
        type="url"
        name="media_url"
        required
        placeholder="YouTube, TikTok or Vimeo URL"
        className="rounded border border-stone-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
      />
      <textarea
        name="content"
        maxLength={20000}
        rows={3}
        placeholder="Caption (optional)"
        className="rounded border border-stone-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
      />
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div>
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-stone-900 text-stone-50 px-4 py-2 text-sm hover:bg-stone-700 disabled:opacity-60"
        >
          {submitting ? 'Adding…' : 'Add entry'}
        </button>
      </div>
    </form>
  )
}
