// Categories for lightweight user-created projects. Keep in sync with
// the check constraint in supabase/phase12_user_projects.sql.

export const USER_PROJECT_CATEGORIES = [
  { value: 'community', label: 'Community' },
  { value: 'arts', label: 'Arts & Culture' },
  { value: 'housing', label: 'Housing' },
  { value: 'skills', label: 'Skills & Learning' },
  { value: 'environment', label: 'Environment' },
  { value: 'health', label: 'Health & Wellbeing' },
  { value: 'justice', label: 'Justice' },
  { value: 'tech_for_good', label: 'Tech for Good' },
  { value: 'other', label: 'Other' },
] as const

export type UserProjectCategory =
  (typeof USER_PROJECT_CATEGORIES)[number]['value']

const CATEGORY_VALUES = new Set<string>(
  USER_PROJECT_CATEGORIES.map((c) => c.value)
)

export function isValidCategory(v: string): v is UserProjectCategory {
  return CATEGORY_VALUES.has(v)
}

export function categoryLabel(value: string): string {
  return (
    USER_PROJECT_CATEGORIES.find((c) => c.value === value)?.label ?? 'Other'
  )
}
