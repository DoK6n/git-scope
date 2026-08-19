import type { Task } from './model'

export function completionRate(tasks: readonly Task[]): number {
  if (tasks.length === 0) return 0
  return tasks.filter((t) => t.done).length / tasks.length
}
