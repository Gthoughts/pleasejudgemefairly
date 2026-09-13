'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { createHelpOutAction } from '../actions'

const MAX_DATES = 12
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10MB

function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9._-]/g, '_')
  return cleaned.length > 0 ? cleaned : 'photo'
}

export default function NewHelpOutForm({ defaultDate }: { defaultDate?: string }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [area, setArea] = useState('')
  const [dates, setDates] = useState<string[]>(defaultDate ? [defaultDate] : [''])
  const [photoUrls, setPhotoUrls] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addDate() {
    if (dates.length < MAX_DATES) setDates((d) => [...d, ''])
  }

  function removeDate(idx: number) {
    setDates((d) => (d.length > 1 ? d.filter((_, i) => i !== idx) : d))
  }

  function updateDate(idx: number, value: string) {
    setDates((d) => d.map((v, i) => (i === idx ? value : v)))
  }

  function removePhoto(url: string) {
    setPhotoUrls((p) => p.filter((u) => u !== url))
  }

  async function onFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null)
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return

    setUploading(true)
    try {
      const supabase = createClient()
      const uploaded: string[] = []
      for (const file of files) {
        if (!file.type.startsWith('image/')) {
          throw new Error('Please choose image files only.')
        }
        if (file.size > MAX_UPLOAD_BYTES) {
          throw new Error(`${file.name} is larger than 10MB. Please pick a smaller image.`)
        }
        const safeName = sanitizeFileName(file.name)
        const path = `${crypto.randomUUID()}/${Date.now()}-${safeName}`
        const { error: upErr } = await supabase.storage
          .from('help-out-photos')
          .upload(path, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type,
          })
        if (upErr) throw new Error('Upload failed: ' + upErr.message)
        const { data: pub } = supabase.storage.from('help-out-photos').getPublicUrl(path)
        uploaded.push(pub.publicUrl)
      }
      setPhotoUrls((p) => [...p, ...uploaded])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong uploading.')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy || uploading) return
    setError(null)

    const cleanDates = Array.from(
      new Set(dates.map((d) => d.trim()).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))
    )
    if (cleanDates.length < 1) {
      setError('Please offer at least one possible date.')
      return
    }

    setBusy(true)
    try {
      const fd = new FormData()
      fd.set('title', title.trim())
      fd.set('description', description.trim())
      fd.set('area', area.trim())
      photoUrls.forEach((u) => fd.append('photo_url', u))
      cleanDates.forEach((d) => fd.append('date', d))
      await createHelpOutAction(fd)
    } catch (err) {
      // A successful server action redirect throws an internal Next.js
      // signal (digest starts with 'NEXT_REDIRECT'). That is NOT an error,
      // so let it through instead of flashing a red message.
      if (
        err &&
        typeof err === 'object' &&
        'digest' in err &&
        typeof (err as { digest?: unknown }).digest === 'string' &&
        (err as { digest: string }).digest.startsWith('NEXT_REDIRECT')
      ) {
        throw err
      }
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      {/* Title */}
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-stone-700 font-medium">Title</span>
        <input
          name="title"
          type="text"
          required
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Help repairing a fallen fence"
          className="rounded border border-stone-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
        />
      </label>

      {/* Description */}
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-stone-700 font-medium">What help do you need?</span>
        <textarea
          name="description"
          required
          maxLength={5000}
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the task. You can post for yourself or on someone's behalf."
          className="rounded border border-stone-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
        />
      </label>

      {/* General area */}
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-stone-700 font-medium">
          General area (town or district), do NOT put your full address
        </span>
        <input
          name="area"
          type="text"
          required
          maxLength={120}
          value={area}
          onChange={(e) => setArea(e.target.value)}
          placeholder="e.g. Didsbury, Manchester"
          className="rounded border border-stone-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
        />
        <span className="text-xs text-stone-500">
          We never store your exact address. Once someone offers to help, you can
          share the precise address privately by messaging them.
        </span>
      </label>

      {/* Photos */}
      <div className="flex flex-col gap-2 text-sm">
        <span className="text-stone-700 font-medium">
          Photos <span className="font-normal text-stone-400">(optional)</span>
        </span>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={onFilesChange}
          disabled={uploading}
          className="block w-full rounded border border-stone-300 p-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-stone-900 file:px-3 file:py-1 file:text-white disabled:opacity-60"
        />
        <span className="text-xs text-stone-500">
          Images only, up to 10MB each. Helps people understand the task.
        </span>
        {uploading && <span className="text-xs text-stone-500">Uploading…</span>}
        {photoUrls.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-2">
            {photoUrls.map((url) => (
              <div key={url} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt=""
                  className="h-20 w-20 rounded object-cover border border-stone-200"
                />
                <button
                  type="button"
                  onClick={() => removePhoto(url)}
                  className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-stone-900 text-xs text-stone-50 hover:bg-stone-700"
                  aria-label="Remove photo"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dates */}
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium text-stone-700">
          Possible dates{' '}
          <span className="font-normal text-stone-400">
            (one or more, up to {MAX_DATES})
          </span>
        </legend>
        <p className="text-xs text-stone-500">
          Offer any days that could work. Helpers can tick the ones they can do,
          and the work can spread across several days.
        </p>
        {dates.map((d, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <input
              type="date"
              value={d}
              onChange={(e) => updateDate(idx, e.target.value)}
              className="rounded border border-stone-300 px-3 py-2 text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-stone-400 w-fit"
            />
            {dates.length > 1 && (
              <button
                type="button"
                onClick={() => removeDate(idx)}
                className="text-stone-400 hover:text-red-600 text-xs"
              >
                Remove
              </button>
            )}
          </div>
        ))}
        {dates.length < MAX_DATES && (
          <button
            type="button"
            onClick={addDate}
            className="self-start text-sm text-stone-600 underline hover:text-stone-900"
          >
            + Add another date
          </button>
        )}
      </fieldset>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      <div>
        <button
          type="submit"
          disabled={busy || uploading}
          className="rounded bg-stone-900 text-stone-50 px-6 py-2.5 text-sm hover:bg-stone-700 disabled:opacity-60"
        >
          {busy ? 'Posting…' : 'Post request'}
        </button>
      </div>
    </form>
  )
}
