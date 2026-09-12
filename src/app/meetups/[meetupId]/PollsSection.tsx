'use client'

import { useTransition } from 'react'
import { voteMeetupPollAction } from '../actions'

export type PollOption = {
  id: string
  label: string
  display_order: number
  voterIds: string[]
}

export type Poll = {
  id: string
  title: string
  poll_type: 'date' | 'location' | 'custom'
  display_order: number
  options: PollOption[]
}

type Props = {
  meetupId: string
  currentUserId: string
  polls: Poll[]
}

const typeLabel: Record<Poll['poll_type'], string> = {
  date: 'Dates',
  location: 'Locations',
  custom: 'Poll',
}

export default function PollsSection({ meetupId, currentUserId, polls }: Props) {
  const [pending, startTransition] = useTransition()

  function toggleVote(optionId: string, pollId: string) {
    const formData = new FormData()
    formData.set('option_id', optionId)
    formData.set('poll_id', pollId)
    formData.set('meetup_id', meetupId)
    startTransition(async () => {
      await voteMeetupPollAction(formData)
    })
  }

  return (
    <div className="space-y-6">
      {polls.map((poll) => {
        // Unique voters across the whole poll (for the "N people voted" line).
        const voterSet = new Set<string>()
        for (const opt of poll.options) for (const v of opt.voterIds) voterSet.add(v)
        const totalVoters = voterSet.size
        const maxVotes = poll.options.reduce(
          (m, o) => Math.max(m, o.voterIds.length),
          0
        )

        return (
          <div
            key={poll.id}
            className="rounded border border-stone-200 bg-stone-50 p-4"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-medium text-stone-800">{poll.title}</h3>
              <span className="shrink-0 text-xs text-stone-400">
                {typeLabel[poll.poll_type]}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-stone-500">
              Tick any options that work for you.{' '}
              {totalVoters > 0 && (
                <span>
                  {totalVoters} {totalVoters === 1 ? 'person has' : 'people have'} voted.
                </span>
              )}
            </p>

            <ul className="mt-3 space-y-2">
              {poll.options.map((opt) => {
                const count = opt.voterIds.length
                const mine = opt.voterIds.includes(currentUserId)
                const pct = maxVotes > 0 ? Math.round((count / maxVotes) * 100) : 0
                return (
                  <li key={opt.id}>
                    <button
                      type="button"
                      onClick={() => toggleVote(opt.id, poll.id)}
                      disabled={pending}
                      aria-pressed={mine}
                      className={`relative block w-full overflow-hidden rounded border px-3 py-2 text-left text-sm transition-colors disabled:opacity-60 ${
                        mine
                          ? 'border-stone-400 bg-white'
                          : 'border-stone-200 bg-white hover:border-stone-400'
                      }`}
                    >
                      {/* Proportion bar */}
                      <span
                        aria-hidden="true"
                        className={`absolute inset-y-0 left-0 ${
                          mine ? 'bg-stone-200' : 'bg-stone-100'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                      <span className="relative flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2">
                          <span
                            className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border text-[10px] ${
                              mine
                                ? 'border-stone-900 bg-stone-900 text-stone-50'
                                : 'border-stone-400 text-transparent'
                            }`}
                          >
                            ✓
                          </span>
                          <span className="text-stone-800">{opt.label}</span>
                        </span>
                        <span className="shrink-0 text-xs text-stone-500">
                          {count} {count === 1 ? 'vote' : 'votes'}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
