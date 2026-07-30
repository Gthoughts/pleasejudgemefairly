'use client'

import { useState } from 'react'
import {
  REPORT_REASON_TYPES,
  reportReasonLabel,
  type ReportReasonType,
} from '@/lib/videos/reports'
import { reportVideoAction } from './actions'

export default function ReportModal({
  videoId,
  onClose,
}: {
  videoId: string
  onClose: () => void
}) {
  const [reason, setReason] = useState<ReportReasonType | null>(null)
  const [note, setNote] = useState<string>('')
  const [busy, setBusy] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<boolean>(false)

  async function submit() {
    if (!reason || busy) return
    setBusy(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.set('video_id', videoId)
      fd.set('reason_type', reason)
      if (note.trim().length > 0) fd.set('note', note.trim())
      await reportVideoAction(fd)
      setDone(true)
      setTimeout(onClose, 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Report failed.')
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      <div className="w-full max-w-sm rounded-lg bg-white p-5 text-stone-900 shadow-xl">
        {done ? (
          <div className="py-4 text-center">
            <div className="text-lg font-medium">Thank you.</div>
            <div className="mt-1 text-sm text-stone-600">
              The video is held for review.
            </div>
          </div>
        ) : (
          <>
            <div className="text-lg font-medium">Report this video</div>
            <div className="mt-1 text-sm text-stone-600">
              This video will be taken down immediately for review. Please
              only report content that genuinely needs a look.
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {REPORT_REASON_TYPES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={
                    'rounded border px-3 py-2 text-sm ' +
                    (reason === r
                      ? 'border-stone-900 bg-stone-900 text-white'
                      : 'border-stone-300 hover:bg-stone-50')
                  }
                >
                  {reportReasonLabel(r)}
                </button>
              ))}
            </div>

            <label className="mt-3 block text-xs text-stone-600">
              Optional note (500 chars max)
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 500))}
                rows={2}
                className="mt-1 w-full rounded border border-stone-300 p-2 text-sm"
                placeholder="Anything the admin should know"
              />
            </label>

            {error ? (
              <div className="mt-3 rounded bg-red-50 p-2 text-xs text-red-800">
                {error}
              </div>
            ) : null}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!reason || busy}
                onClick={submit}
                className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {busy ? 'Sending…' : 'Report'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
