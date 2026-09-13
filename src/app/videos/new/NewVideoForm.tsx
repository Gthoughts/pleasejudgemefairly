'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { submitVideoAction, createVideoSubcategoryAction } from '../actions'
import type { VideoCategory, VideoSubcategory } from '@/lib/videos/categories'

// Client form for adding a video. Upload-only: members upload their own
// short videos to the Supabase 'videos' Storage bucket, and the public URL
// is stored as storage_ref. There is no paste-a-link path.
//
// Category selection is required; subcategory is optional but if the
// user picks "other" they must supply a name and the new subcategory
// is created with status=pending_review.

type Props = {
  categories: VideoCategory[]
  subcatsByCategory: Record<string, VideoSubcategory[]>
}

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024 // 50MB

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9._-]/g, '_')
  return cleaned.length > 0 ? cleaned : 'video'
}

export default function NewVideoForm({ categories, subcatsByCategory }: Props) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState<string>('')
  const [subcategoryId, setSubcategoryId] = useState<string>('')
  const [newSubcategoryName, setNewSubcategoryName] = useState('')
  const [aspect, setAspect] = useState<'portrait' | 'landscape' | 'square' | ''>('')
  const [duration, setDuration] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const subcats = categoryId ? subcatsByCategory[categoryId] ?? [] : []

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null)
    const file = e.target.files?.[0] ?? null
    if (!file) {
      setSelectedFile(null)
      return
    }
    if (!file.type.startsWith('video/')) {
      setSelectedFile(null)
      setError('Please choose a video file.')
      e.target.value = ''
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setSelectedFile(null)
      setError('That file is larger than 50MB. Please pick a smaller clip.')
      e.target.value = ''
      return
    }
    setSelectedFile(file)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setError(null)

    if (!selectedFile) {
      setError('Please choose a video file to upload.')
      return
    }
    if (!selectedFile.type.startsWith('video/')) {
      setError('Please choose a video file.')
      return
    }
    if (selectedFile.size > MAX_UPLOAD_BYTES) {
      setError('That file is larger than 50MB. Please pick a smaller clip.')
      return
    }

    setBusy(true)
    try {
      let finalSubcategoryId = subcategoryId
      if (subcategoryId === '__other__') {
        const trimmed = newSubcategoryName.trim()
        if (trimmed.length === 0)
          throw new Error('Please give the new subcategory a name.')
        const fd = new FormData()
        fd.set('category_id', categoryId)
        fd.set('name', trimmed)
        const created = await createVideoSubcategoryAction(fd)
        finalSubcategoryId = created.id
      }

      // Upload the chosen file to the public 'videos' bucket first, then
      // pass its public URL through as storage_ref.
      setUploading(true)
      const supabase = createClient()
      const safeName = sanitizeFileName(selectedFile.name)
      const path = `${crypto.randomUUID()}/${Date.now()}-${safeName}`
      const { error: upErr } = await supabase.storage
        .from('videos')
        .upload(path, selectedFile, {
          cacheControl: '3600',
          upsert: false,
          contentType: selectedFile.type,
        })
      if (upErr) throw new Error('Upload failed: ' + upErr.message)
      const { data: pub } = supabase.storage.from('videos').getPublicUrl(path)
      const publicUrl = pub.publicUrl
      setUploading(false)

      const fd = new FormData()
      fd.set('source_type', 'upload')
      fd.set('storage_ref', publicUrl)
      fd.set('title', title.trim())
      if (description.trim()) fd.set('description', description.trim())
      fd.set('category_id', categoryId)
      if (finalSubcategoryId) fd.set('subcategory_id', finalSubcategoryId)
      if (aspect) fd.set('aspect_ratio', aspect)
      if (duration) fd.set('duration_seconds', duration)

      await submitVideoAction(fd)
    } catch (err) {
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
      setUploading(false)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="text-sm font-medium text-stone-800">
          Video file
          <input
            type="file"
            accept="video/*"
            onChange={onFileChange}
            className="mt-1 block w-full rounded border border-stone-300 p-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-stone-900 file:px-3 file:py-1 file:text-white"
          />
        </label>
        <div className="mt-1 text-xs text-stone-500">
          For your own short videos — portrait (9:16) works best. Max 50MB.
        </div>
        {selectedFile ? (
          <div className="mt-1 text-xs text-stone-600">
            Selected: {selectedFile.name} ({formatBytes(selectedFile.size)})
          </div>
        ) : null}
      </div>

      <label className="block text-sm font-medium text-stone-800">
        Title
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          required
          className="mt-1 block w-full rounded border border-stone-300 p-2 text-sm"
        />
      </label>

      <label className="block text-sm font-medium text-stone-800">
        Description (optional)
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 2000))}
          rows={3}
          className="mt-1 block w-full rounded border border-stone-300 p-2 text-sm"
        />
      </label>

      <label className="block text-sm font-medium text-stone-800">
        Category
        <select
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value)
            setSubcategoryId('')
          }}
          required
          className="mt-1 block w-full rounded border border-stone-300 p-2 text-sm"
        >
          <option value="">Pick one</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      {categoryId ? (
        <>
          <label className="block text-sm font-medium text-stone-800">
            Subcategory (optional)
            <select
              value={subcategoryId}
              onChange={(e) => setSubcategoryId(e.target.value)}
              className="mt-1 block w-full rounded border border-stone-300 p-2 text-sm"
            >
              <option value="">None</option>
              {subcats.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
              <option value="__other__">Other (create a new one)</option>
            </select>
          </label>
          {subcategoryId === '__other__' ? (
            <label className="block text-sm font-medium text-stone-800">
              New subcategory name
              <input
                type="text"
                value={newSubcategoryName}
                onChange={(e) => setNewSubcategoryName(e.target.value.slice(0, 60))}
                required
                className="mt-1 block w-full rounded border border-stone-300 p-2 text-sm"
              />
              <div className="mt-1 text-xs text-stone-500">
                Live immediately, sent to the admin for a quick sanity check.
              </div>
            </label>
          ) : null}
        </>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-medium text-stone-800">
          Orientation
          <select
            value={aspect}
            onChange={(e) =>
              setAspect(e.target.value as 'portrait' | 'landscape' | 'square' | '')
            }
            className="mt-1 block w-full rounded border border-stone-300 p-2 text-sm"
          >
            <option value="">not sure</option>
            <option value="portrait">Portrait (9:16) — recommended</option>
            <option value="landscape">Landscape</option>
            <option value="square">Square</option>
          </select>
        </label>
        <label className="block text-sm font-medium text-stone-800">
          Duration (seconds, optional)
          <input
            type="number"
            min={1}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="mt-1 block w-full rounded border border-stone-300 p-2 text-sm"
          />
        </label>
      </div>

      {error ? (
        <div className="rounded bg-red-50 p-3 text-sm text-red-800">{error}</div>
      ) : null}

      <button
        type="submit"
        disabled={busy || !title || !categoryId || !selectedFile}
        className="w-full rounded bg-stone-900 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
      >
        {uploading ? 'Uploading…' : busy ? 'Adding…' : 'Add video'}
      </button>
    </form>
  )
}
