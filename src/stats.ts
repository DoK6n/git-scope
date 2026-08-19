import type { Task } from './model'

export function completionRate(tasks: readonly Task[]): number {
  if (tasks.length === 0) return 0
  return tasks.filter((t) => t.done).length / tasks.length
}

export function weeklyDone(tasks: readonly Task[], now = Date.now()): number {
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000
  return tasks.filter((t) => t.done && new Date(t.createdAt).getTime() > weekAgo).length
}
