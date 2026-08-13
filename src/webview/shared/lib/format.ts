/** unix seconds → "YYYY-MM-DD HH:mm" (로컬 시간) */
export function formatDate(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function shortHash(hash: string): string {
  return hash.slice(0, 8)
}
