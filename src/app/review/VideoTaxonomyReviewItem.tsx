'use client'

import { useState } from 'react'
import { formatWhen } from '@/lib/format'
import {
  keepVideoCategoryAction,
  renameVideoCategoryAction,
  mergeVideoCategoryAction,
  rejectVideoCategoryAction,
  keepVideoSubcategoryAction,
  renameVideoSubcategoryAction,
  mergeVideoSubcategoryAction,
  rejectVideoSubcategoryAction,
} from './videos-actions'

// One row in the taxonomy queue. Works for both categories and
// subcategories via the `kind` prop, which switches action targets.
//
// Layout: name + slug + creator + created_at on top, then a strip of
// action buttons. Rename and Reject expand a small inline form.
// Merge shows a dropdown of active peers in the same scope.

type Kind = 'category' | 'subcategory'

type Peer = { id: string; name: string; slug: string }

type Props = {
  kind: Kind
  id: string
  name: string
  slug: string
  createdAt: string
  createdBy: string | null
  createdByUsername: string | null
  parentCategoryName?: string
  videoCount: number
  mergeTargets: Peer[]
}

type Mode = 'idle' | 'rename' | 'merge' | 'reject'

export default function VideoTaxonomyReviewItem(props: Props) {
  const [mode, setMode] = useState<Mode>('idle')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [renameValue, setRenameValue] = useState(props.name)
  const [mergeTargetId, setMergeTargetId] = useState('')
  const [rejectReason, setRejectReason] = useState('')

  async function keep() {
    setBusy(true); setError(null)
    try {
      const fd = new FormData()
      if (props.kind === 'category') {
        fd.set('category_id', props.id)
        await keepVideoCategoryAction(fd)
      } else {
        fd.set('subcategory_id', props.id)
        await keepVideoSubcategoryAction(fd)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  async function rename() {
    if (renameValue.trim().length === 0) return
    setBusy(true); setError(null)
    try {
      const fd = new FormData()
      fd.set('name', renameValue.trim())
      if (props.kind === 'category') {
        fd.set('category_id', props.id)
        await renameVideoCategoryAction(fd)
      } else {
        fd.set('subcategory_id', props.id)
        await renameVideoSubcategoryAction(fd)
      }
      setMode('idle')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  async function merge() {
    if (!mergeTargetId) return
    setBusy(true); setError(null)
    try {
      const fd = new FormData()
      fd.set('source_id', props.id)
      fd.set('target_id', mergeTargetId)
      if (props.kind === 'category') {
        await mergeVideoCategoryAction(fd)
      } else {
        await mergeVideoSubcategoryAction(fd)
      }
      setMode('idle')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  async function reject() {
    setBusy(true); setError(null)
    try {
      const fd = new FormData()
      if (rejectReason.trim().length > 0) fd.set('reason', rejectReason.trim())
      if (props.kind === 'category') {
        fd.set('category_id', props.id)
        await rejectVideoCategoryAction(fd)
      } else {
        fd.set('subcategory_id', props.id)
        await rejectVideoSubcategoryAction(fd)
      }
      setMode('idle')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="py-4">
      <div className="text-sm">
        <span className="font-medium text-stone-900">{props.name}</span>
        <span className="ml-2 text-xs text-stone-500">/{props.slug}</span>
        {props.parentCategoryName ? (
          <span className="ml-2 text-xs text-stone-500">
            under {props.parentCategoryName}
          </span>
        ) : null}
      </div>
      <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-xs text-stone-500">
        <span>
          created by {props.createdByUsername ?? 'unknown'}{' '}
          {formatWhen(props.createdAt)}
        </span>
        <span>·</span>
        <span>
          {props.videoCount} video{props.videoCount === 1 ? '' : 's'} using it
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        <button
          type="button"
          disabled={busy}
          onClick={keep}
          className="rounded border border-emerald-300 bg-white px-2 py-1 text-emerald-800 hover:border-emerald-500 disabled:opacity-50"
        >
          Keep
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setMode(mode === 'rename' ? 'idle' : 'rename')}
          className="rounded border border-stone-300 bg-white px-2 py-1 text-stone-700 hover:border-stone-500"
        >
          Rename
        </button>
        <button
          type="button"
          disabled={busy || props.mergeTargets.length === 0}
          onClick={() => setMode(mode === 'merge' ? 'idle' : 'merge')}
          className="rounded border border-stone-300 bg-white px-2 py-1 text-stone-700 hover:border-stone-500 disabled:opacity-50"
        >
          Merge
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setMode(mode === 'reject' ? 'idle' : 'reject')}
          className="rounded border border-red-300 bg-white px-2 py-1 text-red-700 hover:border-red-500"
        >
          Reject
        </button>
      </div>

      {mode === 'rename' ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value.slice(0, 60))}
            className="flex-1 min-w-40 rounded border border-stone-300 p-1.5 text-sm"
          />
          <button
            type="button"
            disabled={busy || renameValue.trim().length === 0}
            onClick={rename}
            className="rounded bg-stone-900 px-2 py-1 text-xs text-white disabled:opacity-50"
          >
            Save
          </button>
        </div>
      ) : null}

      {mode === 'merge' ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            value={mergeTargetId}
            onChange={(e) => setMergeTargetId(e.target.value)}
            className="min-w-40 rounded border border-stone-300 p-1.5 text-sm"
          >
            <option value="">Pick target…</option>
            {props.mergeTargets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy || !mergeTargetId}
            onClick={merge}
            className="rounded bg-stone-900 px-2 py-1 text-xs text-white disabled:opacity-50"
          >
            Merge into
          </button>
        </div>
      ) : null}

      {mode === 'reject' ? (
        <div className="mt-2 space-y-2">
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value.slice(0, 400))}
            rows={2}
            placeholder="Optional message to the creator"
            className="w-full rounded border border-stone-300 p-1.5 text-sm"
          />
          <div className="flex justify-end">
            <button
              type="button"
              disabled={busy}
              onClick={reject}
              className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
            >
              Reject{props.kind === 'category' ? ' and unpublish videos' : ''}
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="mt-2 rounded bg-red-50 p-1.5 text-xs text-red-800">
          {error}
        </div>
      ) : null}
    </li>
  )
}
