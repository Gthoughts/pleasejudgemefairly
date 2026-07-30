'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatWhen } from '@/lib/format'
import { reportReasonLabel, type ReportReasonType } from '@/lib/videos/reports'
import {
  confirmVideoReportAction,
  warnVideoReportAction,
  permanentBanVideoReportAction,
} from './videos-actions'

type Props = {
  reportId: string
  videoId: string
  videoTitle: string
  reasonType: ReportReasonType
  note: string | null
  reporterUsername: string | null
  reporterWarningsSoFar: number
  reporterRevoked: boolean
  createdAt: string
  otherPendingCount: number
}

export default function VideoReportReviewItem(props: Props) {
  const [busy, setBusy] = useState(false)
  const [adminNote, setAdminNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function submit(
    verdict: 'confirmed' | 'warning' | 'permanent_ban'
  ) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.set('report_id', props.reportId)
      if (adminNote.trim().length > 0) fd.set('note', adminNote.trim())
      if (verdict === 'confirmed') await confirmVideoReportAction(fd)
      else if (verdict === 'warning') await warnVideoReportAction(fd)
      else await permanentBanVideoReportAction(fd)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
      setBusy(false)
    }
  }

  return (
    <li className="py-4">
      <div className="text-sm">
        <span className="font-medium text-stone-900">{props.videoTitle}</span>
      </div>
      <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-xs text-stone-500">
        <span className="rounded bg-stone-100 px-1.5 py-0.5">
          {reportReasonLabel(props.reasonType)}
        </span>
        <span>reported {formatWhen(props.createdAt)}</span>
        <span>·</span>
        <span>
          by {props.reporterUsername ?? 'unknown'} (warnings so far:{' '}
          {props.reporterWarningsSoFar}
          {props.reporterRevoked ? ', already revoked' : ''})
        </span>
        {props.otherPendingCount > 0 ? (
          <>
            <span>·</span>
            <span>
              plus {props.otherPendingCount} other pending report
              {props.otherPendingCount === 1 ? '' : 's'} on this video
            </span>
          </>
        ) : null}
      </div>
      {props.note ? (
        <div className="mt-2 rounded bg-stone-50 p-2 text-xs text-stone-700">
          {props.note}
        </div>
      ) : null}

      <div className="mt-2">
        <Link
          href={`/videos/${props.videoId}`}
          className="text-xs text-stone-600 underline hover:text-stone-900"
        >
          Open the video
        </Link>
      </div>

      <div className="mt-3 space-y-2">
        <textarea
          value={adminNote}
          onChange={(e) => setAdminNote(e.target.value.slice(0, 500))}
          rows={2}
          placeholder="Optional note included in the DM to the user"
          className="w-full rounded border border-stone-300 p-1.5 text-sm"
        />
        <div className="flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            disabled={busy}
            onClick={() => submit('confirmed')}
            className="rounded border border-red-300 bg-white px-2 py-1 text-red-700 hover:border-red-500 disabled:opacity-50"
          >
            Confirmed (unpublish video)
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => submit('warning')}
            className="rounded border border-amber-300 bg-white px-2 py-1 text-amber-800 hover:border-amber-500 disabled:opacity-50"
          >
            Warning (genuine mistake)
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => submit('permanent_ban')}
            className="rounded border border-stone-800 bg-stone-900 px-2 py-1 text-white hover:bg-stone-800 disabled:opacity-50"
          >
            Permanent ban (bad faith)
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-2 rounded bg-red-50 p-1.5 text-xs text-red-800">
          {error}
        </div>
      ) : null}
    </li>
  )
}
