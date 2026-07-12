'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { submitResourceAction, getPdfUploadTargetAction } from '../../actions'
import {
  SOCIAL_MEDIA_PLATFORMS,
  SOCIAL_MEDIA_VIDEOS_SLUG,
} from '@/lib/library-categories'

const MAX_PDF_BYTES = 25 * 1024 * 1024

// Client component for /library/[category]/new. Admins see an extra
// "Upload PDF" field. When a PDF is selected we bypass the server
// action for the file bytes (Vercel Hobby caps request bodies well
// below a book-sized PDF) and PUT the file straight to Supabase
// Storage via a signed upload URL; the server action then only
// receives the storage path plus the usual metadata.
export default function NewResourceForm({
  category,
  isAdmin,
}: {
  category: string
  isAdmin: boolean
}) {
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasPdf = pdfFile !== null
  const isSocialVideos = category === SOCIAL_MEDIA_VIDEOS_SLUG

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (submitting) return
    setError(null)
    setSubmitting(true)

    try {
      const form = e.currentTarget
      const fd = new FormData(form)
      // Strip the raw file — we upload it separately, then attach the path.
      fd.delete('pdf')

      if (hasPdf && pdfFile) {
        if (pdfFile.type !== 'application/pdf') {
          throw new Error('PDF must be an application/pdf file.')
        }
        if (pdfFile.size > MAX_PDF_BYTES) {
          throw new Error(
            `PDF is ${(pdfFile.size / (1024 * 1024)).toFixed(1)} MB; max is 25 MB.`
          )
        }

        const { path, token } = await getPdfUploadTargetAction()
        const supabase = createClient()
        const { error: upErr } = await supabase.storage
          .from('library-pdfs')
          .uploadToSignedUrl(path, token, pdfFile, {
            contentType: 'application/pdf',
            upsert: false,
          })
        if (upErr) throw new Error(`Upload failed: ${upErr.message}`)

        fd.set('pdf_path', path)
      }

      // submitResourceAction redirects on success, so the promise
      // "resolves" via a NEXT_REDIRECT error which we let bubble.
      await submitResourceAction(fd)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5">
      <input type="hidden" name="category" value={category} />

      {isSocialVideos && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-stone-700">Platform</span>
          <select
            name="platform"
            required
            defaultValue=""
            className="rounded border border-stone-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
          >
            <option value="" disabled>
              Choose one…
            </option>
            {SOCIAL_MEDIA_PLATFORMS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-stone-700">
          {isSocialVideos ? 'Link to the video' : 'Link (URL)'}
          {isAdmin && !isSocialVideos && (
            <span className="ml-1 font-normal text-stone-500">
              {hasPdf ? '(optional — PDF provided)' : ''}
            </span>
          )}
        </span>
        <input
          name="url"
          type="url"
          required={isSocialVideos || !hasPdf}
          placeholder="https://"
          className="rounded border border-stone-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-stone-700">Title</span>
        <input
          name="title"
          required
          minLength={1}
          maxLength={300}
          className="rounded border border-stone-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-stone-700">
          Description{' '}
          <span className="font-normal text-stone-500">
            (max 500 characters)
          </span>
        </span>
        <textarea
          name="description"
          required
          minLength={1}
          maxLength={500}
          rows={5}
          className="rounded border border-stone-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
        />
      </label>

      {isAdmin && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-stone-700">
            PDF{' '}
            <span className="font-normal text-stone-500">
              (optional, max 25 MB, admin only)
            </span>
          </span>
          <input
            name="pdf"
            type="file"
            accept="application/pdf"
            onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
            className="text-stone-700 file:mr-3 file:rounded file:border file:border-stone-300 file:bg-white file:px-3 file:py-1.5 file:text-sm hover:file:border-stone-500"
          />
          {pdfFile && (
            <span className="text-xs text-stone-500">
              {pdfFile.name} · {(pdfFile.size / (1024 * 1024)).toFixed(2)} MB
            </span>
          )}
        </label>
      )}

      {error && (
        <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-stone-900 text-stone-50 px-4 py-2 hover:bg-stone-700 disabled:cursor-wait disabled:bg-stone-500"
        >
          {submitting
            ? hasPdf
              ? 'Uploading PDF…'
              : 'Submitting…'
            : 'Submit'}
        </button>
        <Link
          href={`/library/${category}`}
          className="text-sm text-stone-600 hover:underline"
        >
          Cancel
        </Link>
      </div>
    </form>
  )
}
