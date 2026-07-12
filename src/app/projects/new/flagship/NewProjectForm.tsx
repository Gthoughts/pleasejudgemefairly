'use client'

import { useState } from 'react'
import { createProjectAction } from '../../actions'

type TierDraft = {
  name: string
  upfront: string
  monthly: string
  months: string
  slots: string
  phaseChoice: boolean
}

const DEFAULT_TIERS: TierDraft[] = [
  { name: '£500', upfront: '500', monthly: '100', months: '36', slots: '300', phaseChoice: false },
  { name: '£1,000', upfront: '1000', monthly: '100', months: '36', slots: '350', phaseChoice: false },
  { name: '£2,500', upfront: '2500', monthly: '100', months: '36', slots: '400', phaseChoice: false },
  { name: '£5,000', upfront: '5000', monthly: '100', months: '36', slots: '850', phaseChoice: false },
  { name: '£10,000', upfront: '10000', monthly: '0', months: '0', slots: '650', phaseChoice: true },
  { name: '£15,000', upfront: '15000', monthly: '0', months: '0', slots: '450', phaseChoice: true },
  // Non-financial options shown in the registration dropdown but excluded
  // from the model table (total_amount = 0).
  { name: 'Sweat equity / labour only', upfront: '0', monthly: '0', months: '0', slots: '1', phaseChoice: false },
  { name: 'Not sure yet', upfront: '0', monthly: '0', months: '0', slots: '1', phaseChoice: false },
]

const blankTier = (): TierDraft => ({
  name: '',
  upfront: '0',
  monthly: '0',
  months: '0',
  slots: '1',
  phaseChoice: false,
})

function formatGBP(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(n)
}

export default function NewProjectForm() {
  const [tiers, setTiers] = useState<TierDraft[]>(DEFAULT_TIERS)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function updateTier<K extends keyof TierDraft>(
    idx: number,
    key: K,
    value: TierDraft[K]
  ) {
    setTiers((ts) =>
      ts.map((t, i) => (i === idx ? { ...t, [key]: value } : t))
    )
  }

  function addTier() {
    setTiers((ts) => [...ts, blankTier()])
  }

  function removeTier(idx: number) {
    setTiers((ts) => ts.filter((_, i) => i !== idx))
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      if (tiers.length === 0) {
        throw new Error('At least one tier is required.')
      }
      for (const t of tiers) {
        if (!t.name.trim()) throw new Error('All tiers must have a name.')
      }
      const formData = new FormData(e.currentTarget)
      tiers.forEach((t, i) => {
        formData.set(`tier_name_${i}`, t.name.trim())
        formData.set(`tier_upfront_${i}`, t.upfront || '0')
        formData.set(`tier_monthly_${i}`, t.monthly || '0')
        formData.set(`tier_months_${i}`, t.months || '0')
        formData.set(`tier_slots_${i}`, t.slots || '1')
        formData.set(
          `tier_phase_choice_${i}`,
          t.phaseChoice ? 'true' : 'false'
        )
      })
      await createProjectAction(formData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-7">
      {/* Title */}
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-stone-700 font-medium">Title</span>
        <input
          name="title"
          type="text"
          required
          maxLength={200}
          placeholder="e.g. The Land Project"
          className="rounded border border-stone-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
        />
      </label>

      {/* Short description */}
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-stone-700 font-medium">Short description</span>
        <textarea
          name="short_description"
          required
          maxLength={500}
          rows={2}
          placeholder="One or two sentences shown on the project list."
          className="rounded border border-stone-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
        />
      </label>

      {/* Vision */}
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-stone-700 font-medium">
          Vision (markdown){' '}
          <span className="font-normal text-stone-400">
            — headings, lists, paragraphs all supported
          </span>
        </span>
        <textarea
          name="vision_content"
          required
          maxLength={200000}
          rows={14}
          placeholder={`# The vision\n\nWhat the project is, why it matters, and what it looks like once built.`}
          className="rounded border border-stone-300 px-3 py-2 font-mono text-xs bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
        />
      </label>

      {/* PDF URL */}
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-stone-700 font-medium">
          External PDF download URL{' '}
          <span className="font-normal text-stone-400">(optional)</span>
        </span>
        <input
          name="pdf_url"
          type="url"
          maxLength={1000}
          placeholder="https://…"
          className="rounded border border-stone-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
        />
      </label>

      {/* Funding target / per-person target */}
      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-stone-700 font-medium">Funding target (£)</span>
          <input
            name="funding_target"
            type="number"
            min={0}
            step="0.01"
            defaultValue={25800000}
            className="rounded border border-stone-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-stone-700 font-medium">Per-person target (£)</span>
          <input
            name="per_person_target"
            type="number"
            min={0}
            step="0.01"
            defaultValue={8600}
            className="rounded border border-stone-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
          />
        </label>
      </div>

      {/* Model content */}
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-stone-700 font-medium">
          Model explanation (markdown){' '}
          <span className="font-normal text-stone-400">
            — shown below the tier table
          </span>
        </span>
        <textarea
          name="model_content"
          required
          maxLength={200000}
          rows={14}
          defaultValue={`## How the tiers work

The project needs roughly £8,600 per person to fund the land and infrastructure. If everyone paid that amount we'd hit the target exactly. But not everyone can, and that's fine.

The tiers below £5,000 are subsidised by the tiers above. When someone commits at £15,000, they generate £6,400 more than the per-person target. That surplus unlocks slots at the lower tiers for people who can't afford the full amount. The more people who join at the higher tiers, the more accessible slots open up at the lower ones.

Contributors at £10,000 and £15,000 get to choose which build phase they join, including phase 1 when the land is being shaped. Contributors at the lower tiers are allocated to phases as slots become available.

Anyone who contributes more than the final per-person cost will be refunded exactly the excess amount once the project is fully funded. No interest. No profit. Just the overpayment returned. This may take several years as later phases fill up.

The target slot numbers above are a working model, not a fixed plan. They'll be refined as the community grows and as grants and land income offset some of the funding needed.

Nobody is excluded because of money. If you can't afford a financial contribution but you have skills, time and commitment to offer, there will be a sweat equity path where labour hours count toward your membership. That structure is being developed and will be shared here when it's ready.

No money is being collected yet. The legal structure (likely a Community Land Trust or Community Benefit Society) needs to be established first, reviewed by a solicitor, and agreed by the founding members. Until then, this is registration of interest only.`}
          className="rounded border border-stone-300 px-3 py-2 font-mono text-xs bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
        />
      </label>

      {/* Tier builder */}
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium text-stone-700">
          Tiers
        </legend>
        <p className="text-xs text-stone-500">
          Each tier needs a name, the upfront amount, optional monthly amount
          and number of months, the target number of slots, and whether the
          tier gets to choose its build phase. Total is computed as upfront +
          monthly × months.
        </p>

        <ul className="flex flex-col gap-3">
          {tiers.map((t, idx) => {
            const upfront = parseFloat(t.upfront) || 0
            const monthly = parseFloat(t.monthly) || 0
            const months = parseInt(t.months || '0', 10) || 0
            const total = upfront + monthly * months
            return (
              <li
                key={idx}
                className="rounded border border-stone-200 bg-stone-50 p-3"
              >
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                  <label className="sm:col-span-3 flex flex-col gap-1 text-xs">
                    <span className="text-stone-600">Name</span>
                    <input
                      type="text"
                      value={t.name}
                      onChange={(e) => updateTier(idx, 'name', e.target.value)}
                      placeholder="e.g. £500"
                      className="rounded border border-stone-300 px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
                    />
                  </label>
                  <label className="sm:col-span-2 flex flex-col gap-1 text-xs">
                    <span className="text-stone-600">Upfront</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={t.upfront}
                      onChange={(e) => updateTier(idx, 'upfront', e.target.value)}
                      className="rounded border border-stone-300 px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
                    />
                  </label>
                  <label className="sm:col-span-2 flex flex-col gap-1 text-xs">
                    <span className="text-stone-600">Monthly</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={t.monthly}
                      onChange={(e) => updateTier(idx, 'monthly', e.target.value)}
                      className="rounded border border-stone-300 px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
                    />
                  </label>
                  <label className="sm:col-span-1 flex flex-col gap-1 text-xs">
                    <span className="text-stone-600">Months</span>
                    <input
                      type="number"
                      min={0}
                      value={t.months}
                      onChange={(e) => updateTier(idx, 'months', e.target.value)}
                      className="rounded border border-stone-300 px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
                    />
                  </label>
                  <label className="sm:col-span-2 flex flex-col gap-1 text-xs">
                    <span className="text-stone-600">Slots</span>
                    <input
                      type="number"
                      min={1}
                      value={t.slots}
                      onChange={(e) => updateTier(idx, 'slots', e.target.value)}
                      className="rounded border border-stone-300 px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
                    />
                  </label>
                  <div className="sm:col-span-2 flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      id={`tier_phase_${idx}`}
                      checked={t.phaseChoice}
                      onChange={(e) =>
                        updateTier(idx, 'phaseChoice', e.target.checked)
                      }
                      className="h-4 w-4"
                    />
                    <label
                      htmlFor={`tier_phase_${idx}`}
                      className="text-stone-700"
                    >
                      Phase choice
                    </label>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-stone-500">
                  <span>Total per slot: {formatGBP(total)}</span>
                  <button
                    type="button"
                    onClick={() => removeTier(idx)}
                    className="text-stone-400 hover:text-red-700 underline"
                  >
                    Remove tier
                  </button>
                </div>
              </li>
            )
          })}
        </ul>

        <button
          type="button"
          onClick={addTier}
          className="self-start text-sm text-stone-600 underline hover:text-stone-900"
        >
          + Add a tier
        </button>
      </fieldset>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      <div>
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-stone-900 text-stone-50 px-6 py-2.5 text-sm hover:bg-stone-700 disabled:opacity-60"
        >
          {submitting ? 'Creating…' : 'Create project'}
        </button>
      </div>
    </form>
  )
}
