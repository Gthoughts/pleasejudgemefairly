'use client'

import { useState, useTransition } from 'react'
import {
  registerInterestAction,
  withdrawInterestAction,
} from '../actions'
import { AVAILABILITY_OPTIONS, AVAILABILITY_LABEL, type Availability } from '@/lib/projects'

type Tier = {
  id: string
  name: string
  display_order: number
}

type ExistingRegistration = {
  tier_id: string
  skills_text: string
  location_text: string
  motivation_text: string
  availability: Availability
}

type Props = {
  projectId: string
  tiers: Tier[]
  existing: ExistingRegistration | null
}

export default function RegisterInterestSection({
  projectId,
  tiers,
  existing,
}: Props) {
  const [open, setOpen] = useState(existing === null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<string | null>(null)

  const [tierId, setTierId] = useState<string>(
    existing?.tier_id ?? tiers[0]?.id ?? ''
  )
  const [skills, setSkills] = useState(existing?.skills_text ?? '')
  const [location, setLocation] = useState(existing?.location_text ?? '')
  const [motivation, setMotivation] = useState(existing?.motivation_text ?? '')
  const [availability, setAvailability] = useState<Availability>(
    existing?.availability ?? 'flexible'
  )

  async function submit() {
    setError(null)
    setConfirmation(null)
    if (!tierId) {
      setError('Please choose a tier.')
      return
    }
    const formData = new FormData()
    formData.set('project_id', projectId)
    formData.set('tier_id', tierId)
    formData.set('skills_text', skills)
    formData.set('location_text', location)
    formData.set('motivation_text', motivation)
    formData.set('availability', availability)
    startTransition(async () => {
      try {
        await registerInterestAction(formData)
        setConfirmation(
          existing
            ? 'Your registration has been updated.'
            : 'Thanks — your interest has been recorded.'
        )
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save.')
      }
    })
  }

  async function withdraw() {
    setError(null)
    setConfirmation(null)
    if (!confirm('Withdraw your registration?')) return
    const formData = new FormData()
    formData.set('project_id', projectId)
    startTransition(async () => {
      try {
        await withdrawInterestAction(formData)
        setConfirmation('Your registration has been withdrawn.')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not withdraw.')
      }
    })
  }

  if (existing && !open) {
    const tierName =
      tiers.find((t) => t.id === existing.tier_id)?.name ?? 'unknown'
    return (
      <div className="rounded border border-stone-200 bg-stone-50 px-4 py-3">
        <p className="text-sm text-stone-700">
          You&rsquo;ve registered interest at{' '}
          <span className="font-medium">{tierName}</span>{' '}
          ({AVAILABILITY_LABEL[existing.availability]}).
        </p>
        <div className="mt-3 flex items-center gap-4 text-sm">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-stone-700 underline hover:text-stone-900"
          >
            Update my answers
          </button>
          <button
            type="button"
            onClick={withdraw}
            disabled={pending}
            className="text-stone-500 underline hover:text-stone-800 disabled:opacity-60"
          >
            {pending ? 'Withdrawing…' : 'Withdraw registration'}
          </button>
        </div>
        {confirmation && (
          <p className="mt-2 text-xs text-stone-600">{confirmation}</p>
        )}
        {error && (
          <p role="alert" className="mt-2 text-xs text-red-700">
            {error}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="rounded border border-stone-200 bg-stone-50 p-4">
      <p className="text-xs text-stone-500">
        This is registration of interest only. No money is collected. You can
        update or withdraw your registration at any time.
      </p>

      <label className="mt-4 flex flex-col gap-1 text-sm">
        <span className="text-stone-700 font-medium">
          Which tier would you be considering?
        </span>
        <select
          value={tierId}
          onChange={(e) => setTierId(e.target.value)}
          className="rounded border border-stone-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
        >
          {tiers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>

      <label className="mt-4 flex flex-col gap-1 text-sm">
        <span className="text-stone-700 font-medium">
          What skills or experience could you bring?
        </span>
        <textarea
          rows={3}
          maxLength={500}
          value={skills}
          onChange={(e) => setSkills(e.target.value)}
          className="rounded border border-stone-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
        />
        <span className="text-xs text-stone-500">
          Farming, building, teaching, cooking, medical, legal, financial,
          technical, anything. All skills count.
        </span>
      </label>

      <label className="mt-4 flex flex-col gap-1 text-sm">
        <span className="text-stone-700 font-medium">Where are you based?</span>
        <input
          type="text"
          maxLength={200}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="rounded border border-stone-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
        />
      </label>

      <label className="mt-4 flex flex-col gap-1 text-sm">
        <span className="text-stone-700 font-medium">What draws you to this?</span>
        <textarea
          rows={3}
          maxLength={500}
          value={motivation}
          onChange={(e) => setMotivation(e.target.value)}
          className="rounded border border-stone-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
        />
      </label>

      <label className="mt-4 flex flex-col gap-1 text-sm">
        <span className="text-stone-700 font-medium">Availability</span>
        <select
          value={availability}
          onChange={(e) => setAvailability(e.target.value as Availability)}
          className="rounded border border-stone-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
        >
          {AVAILABILITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded bg-stone-900 text-stone-50 px-5 py-2 text-sm hover:bg-stone-700 disabled:opacity-60"
        >
          {pending
            ? 'Saving…'
            : existing
            ? 'Save changes'
            : 'Register my interest'}
        </button>
        {existing && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-sm text-stone-600 hover:underline"
          >
            Cancel
          </button>
        )}
      </div>

      {confirmation && (
        <p className="mt-3 text-sm text-stone-700">{confirmation}</p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
