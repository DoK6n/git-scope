import type { Task } from './model'

/** RFC 4180 기준 필드 이스케이프 */
function escapeField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export function toCsv(tasks: readonly Task[]): string {
  const rows = tasks.map((t) => [String(t.id), escapeField(t.title), String(t.done)].join(','))
  return ['id,title,done', ...rows].join('\n')
}
