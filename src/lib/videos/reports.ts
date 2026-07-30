// Report-related constants and helpers for the video moderation
// system. Keep in sync with supabase/phase19_videos.sql sections
// 12 through 15.

// Long-press duration on the video player before the Report modal
// opens. Wayne set 3s; a visual progress ring should fill during
// this window so users know something is happening.
export const REPORT_LONG_PRESS_MS = 3_000

// Maximum reports one user can file in a rolling 24 hours. Beyond
// this, the report gesture is silently disabled until reports age
// out of the window. Enforced by can_report_video() RPC and the
// server action; the DB is source of truth.
export const REPORT_RATE_LIMIT_PER_DAY = 5

// Number of "warning" verdicts (admin decided the video was fine
// but the report looked like a genuine mistake) that a user can
// accumulate before their report privilege is permanently revoked.
// Enforced by the handle_video_report_verdict trigger.
export const REPORT_WARNING_THRESHOLD = 3

export const REPORT_REASON_TYPES = ['adult', 'illegal', 'spam', 'other'] as const
export type ReportReasonType = (typeof REPORT_REASON_TYPES)[number]

const REPORT_REASON_LABELS: Record<ReportReasonType, string> = {
  adult: 'Adult',
  illegal: 'Illegal',
  spam: 'Spam',
  other: 'Other',
}

export function reportReasonLabel(r: ReportReasonType): string {
  return REPORT_REASON_LABELS[r]
}

export const REPORT_STATUSES = [
  'pending',
  'confirmed',
  'warning',
  'permanent_ban',
] as const
export type ReportStatus = (typeof REPORT_STATUSES)[number]

const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  warning: 'Warning',
  permanent_ban: 'Permanent ban',
}

export function reportStatusLabel(s: ReportStatus): string {
  return REPORT_STATUS_LABELS[s]
}

// Reason a user's report privilege was revoked, stored on
// users.video_report_revoked_reason.
export const REVOCATION_REASONS = ['warnings_threshold', 'permanent_ban'] as const
export type RevocationReason = (typeof REVOCATION_REASONS)[number]
