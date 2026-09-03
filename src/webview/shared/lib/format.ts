/** unix seconds → "YYYY-MM-DD HH:mm" (로컬 시간) */
export function formatDate(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** unix seconds → compact human relative time (for example "6 days ago", "last week"). */
export function formatRelativeTime(
  unixSeconds: number,
  nowMs = Date.now(),
  locale: string = 'en',
): string {
  const elapsedSeconds = unixSeconds - nowMs / 1000
  const absolute = Math.abs(elapsedSeconds)
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  if (absolute < 60) return formatter.format(Math.round(elapsedSeconds), 'second')
  if (absolute < 60 * 60) return formatter.format(Math.round(elapsedSeconds / 60), 'minute')
  if (absolute < 24 * 60 * 60) return formatter.format(Math.round(elapsedSeconds / 3600), 'hour')
  if (absolute < 7 * 24 * 60 * 60) return formatter.format(Math.round(elapsedSeconds / 86400), 'day')
  if (absolute < 30 * 24 * 60 * 60) return formatter.format(Math.round(elapsedSeconds / 604800), 'week')
  if (absolute < 365 * 24 * 60 * 60) return formatter.format(Math.round(elapsedSeconds / 2592000), 'month')
  return formatter.format(Math.round(elapsedSeconds / 31536000), 'year')
}

export function shortHash(hash: string): string {
  return hash.slice(0, 8)
}
