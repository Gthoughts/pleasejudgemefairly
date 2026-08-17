'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { StorytellerRow } from '@/lib/this-is-me/queries'

type Order = 'random' | 'latest' | 'oldest'

// Deterministic random shuffle seeded by a session-scoped value, so
// the order stays the same across re-renders inside the same visit.
function shuffled<T>(input: T[], seed: number): T[] {
  const arr = input.slice()
  let s = seed || 1
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280
    const j = Math.floor((s / 233280) * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export default function LandingList({
  storytellers,
  myUsername,
}: {
  storytellers: StorytellerRow[]
  myUsername: string | null
}) {
  const [order, setOrder] = useState<Order>('random')
  const [query, setQuery] = useState('')
  const [seed] = useState(() => Math.floor(Math.random() * 1_000_000))

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? storytellers.filter((s) => s.username.toLowerCase().includes(q))
      : storytellers
    if (order === 'latest') {
      return filtered
        .slice()
        .sort(
          (a, b) =>
            new Date(b.latest_entry_at).getTime() -
            new Date(a.latest_entry_at).getTime()
        )
    }
    if (order === 'oldest') {
      return filtered
        .slice()
        .sort(
          (a, b) =>
            new Date(a.first_entry_at).getTime() -
            new Date(b.first_entry_at).getTime()
        )
    }
    return shuffled(filtered, seed)
  }, [storytellers, order, query, seed])

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        {myUsername ? (
          <Link
            href={`/thisisme/${myUsername}`}
            className="rounded bg-stone-900 text-stone-50 px-3 py-1.5 text-sm hover:bg-stone-700"
          >
            Your story
          </Link>
        ) : null}

        <div className="ml-auto flex flex-wrap items-center gap-2 text-sm">
          <OrderChip active={order === 'random'} onClick={() => setOrder('random')}>
            Random
          </OrderChip>
          <OrderChip active={order === 'latest'} onClick={() => setOrder('latest')}>
            Latest
          </OrderChip>
          <OrderChip active={order === 'oldest'} onClick={() => setOrder('oldest')}>
            Oldest
          </OrderChip>
        </div>
      </div>

      <input
        type="search"
        placeholder="Search a username"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded border border-stone-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
      />

      {rows.length === 0 ? (
        <p className="text-sm text-stone-500">
          {storytellers.length === 0
            ? 'No stories yet. Be the first — head to Your story above.'
            : 'No usernames match that search.'}
        </p>
      ) : (
        <ul className="divide-y divide-stone-200 border-y border-stone-200">
          {rows.map((s) => (
            <li key={s.user_id} className="py-4">
              <Link
                href={`/thisisme/${s.username}`}
                className="block hover:bg-stone-50 rounded px-1 -mx-1 py-1"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium text-stone-800">
                    {s.username}
                  </span>
                  <span className="text-xs text-stone-400 shrink-0">
                    {s.entry_count} {s.entry_count === 1 ? 'entry' : 'entries'}
                  </span>
                </div>
                {s.first_entry_preview ? (
                  <p className="mt-1 text-sm text-stone-600 line-clamp-2">
                    {s.first_entry_preview}
                  </p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function OrderChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'rounded-full border px-3 py-1 text-xs ' +
        (active
          ? 'border-stone-900 bg-stone-900 text-stone-50'
          : 'border-stone-300 text-stone-700 hover:bg-stone-100')
      }
    >
      {children}
    </button>
  )
}
