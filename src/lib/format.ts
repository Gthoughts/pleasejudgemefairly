// Shared formatting helpers. Kept deliberately small.

export function formatWhen(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
