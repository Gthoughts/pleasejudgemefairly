'use client'

import { useMemo, useState } from 'react'
import { detectPlatform, VIDEO_PLATFORMS, platformLabel } from '@/lib/videos/platforms'
import { submitVideoAction, createVideoSubcategoryAction } from '../actions'
import type { VideoCategory, VideoSubcategory } from '@/lib/videos/categories'

// Client form for adding a video. Paste-a-link path is fully wired;
// the upload path is stubbed until the Hetzner + PeerTube instance
// is provisioned (or we swap in another storage adapter).
//
// Category selection is required; subcategory is optional but if the
// user picks "other" they must supply a name and the new subcategory
// is created with status=pending_review.

type Props = {
  categories: VideoCategory[]
  subcatsByCategory: Record<string, VideoSubcategory[]>
}

export default function NewVideoForm({ categories, subcatsByCategory }: Props) {
  const [sourceType, setSourceType] = useState<'external' | 'upload'>('external')
  const [externalUrl, setExternalUrl] = useState('')
  const [manualPlatform, setManualPlatform] = useState<string>('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState<string>('')
  const [subcategoryId, setSubcategoryId] = useState<string>('')
  const [newSubcategoryName, setNewSubcategoryName] = useState('')
  const [aspect, setAspect] = useState<'portrait' | 'landscape' | 'square' | ''>('')
  const [duration, setDuration] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const detected = useMemo(() => {
    if (!externalUrl) return null
    return detectPlatform(externalUrl)
  }, [externalUrl])

  const subcats = categoryId ? subcatsByCategory[categoryId] ?? [] : []

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setError(null)
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

      const fd = new FormData()
      fd.set('source_type', sourceType)
      if (sourceType === 'external') {
        fd.set('external_url', externalUrl.trim())
        if (manualPlatform) fd.set('external_platform', manualPlatform)
      } else {
        throw new Error(
          'File uploads are not enabled yet. Paste a link for now, or wait for Hetzner storage to come online.'
        )
      }
      fd.set('title', title.trim())
      if (description.trim()) fd.set('description', description.trim())
      fd.set('category_id', categoryId)
      if (finalSubcategoryId) fd.set('subcategory_id', finalSubcategoryId)
      if (aspect) fd.set('aspect_ratio', aspect)
      if (duration) fd.set('duration_seconds', duration)

      await submitVideoAction(fd)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <div className="text-sm font-medium text-stone-800">Source</div>
        <div className="mt-1 flex gap-2">
          <button
            type="button"
            onClick={() => setSourceType('external')}
            className={
              'flex-1 rounded border px-3 py-2 text-sm ' +
              (sourceType === 'external'
                ? 'border-stone-900 bg-stone-900 text-white'
                : 'border-stone-300 hover:bg-stone-50')
            }
          >
            Paste a link
          </button>
          <button
            type="button"
            onClick={() => setSourceType('upload')}
            className={
              'flex-1 rounded border px-3 py-2 text-sm ' +
              (sourceType === 'upload'
                ? 'border-stone-900 bg-stone-900 text-white'
                : 'border-stone-300 hover:bg-stone-50')
            }
          >
            Upload a file
          </button>
        </div>
      </div>

      {sourceType === 'external' ? (
        <div>
          <label className="text-sm font-medium text-stone-800">
            Video URL
            <input
              type="url"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              placeholder="youtube.com/shorts/… or tiktok.com/@user/video/… or instagram.com/reel/…"
              className="mt-1 block w-full rounded border border-stone-300 p-2 text-sm"
              required
            />
          </label>
          <div className="mt-1 text-xs text-stone-500">
            Short-form portrait content only: YouTube Shorts, TikTok, or
            Instagram Reels. Regular landscape videos are not accepted.
          </div>
          {externalUrl && !detected ? (
            <div className="mt-1 rounded bg-amber-50 p-2 text-xs text-amber-800">
              That URL is not one of the supported short-form platforms.
            </div>
          ) : null}
          {detected ? (
            <div className="mt-1 text-xs text-stone-500">
              Detected: {platformLabel(detected)}. If that is wrong pick one
              below:
              <select
                value={manualPlatform}
                onChange={(e) => setManualPlatform(e.target.value)}
                className="ml-2 rounded border border-stone-300 px-2 py-1 text-xs"
              >
                <option value="">use detected</option>
                {VIDEO_PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {platformLabel(p)}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
          Uploads are not enabled yet. Paste a link from another site instead
          while we bring storage online.
        </div>
      )}

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
            <option value="portrait">Portrait (9:16)</option>
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
        disabled={busy || !title || !categoryId || (sourceType === 'external' && !externalUrl)}
        className="w-full rounded bg-stone-900 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
      >
        {busy ? 'Adding…' : 'Add video'}
      </button>
    </form>
  )
}
