// Constants shared between project pages. Kept separate from the server
// actions file because a "use server" file may only export async functions.

export const AVAILABILITY_OPTIONS = [
  { value: 'weekends', label: 'Weekends' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'both', label: 'Both' },
  { value: 'flexible', label: 'Flexible' },
  { value: 'relocate', label: 'I could relocate full time' },
] as const

export type Availability = (typeof AVAILABILITY_OPTIONS)[number]['value']

export const AVAILABILITY_LABEL: Record<Availability, string> = {
  weekends: 'Weekends',
  weekdays: 'Weekdays',
  both: 'Both',
  flexible: 'Flexible',
  relocate: 'I could relocate full time',
}

export const SWEAT_EQUITY_TIER_NAME = 'Sweat equity / labour only'
export const NOT_SURE_TIER_NAME = 'Not sure yet'

export function formatGBP(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(amount)
}
