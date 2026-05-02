const dateFormatter = new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: '2-digit' })

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function formatEntryDate(date: Date): string {
  const now = new Date()
  const today = startOfDay(now)
  const target = startOfDay(date)
  if (target.getTime() === today.getTime()) return 'Today'
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (target.getTime() === yesterday.getTime()) return 'Yesterday'
  return formatTableDate(date)
}

export function formatTableDate(date: Date): string {
  // Format: "2026 Apr 25"
  const parts = dateFormatter.formatToParts(date)
  const year = parts.find((p) => p.type === 'year')?.value ?? ''
  const month = parts.find((p) => p.type === 'month')?.value ?? ''
  const day = parts.find((p) => p.type === 'day')?.value ?? ''
  return `${year} ${month} ${day}`
}
