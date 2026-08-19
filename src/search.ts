import type { Task } from './model'

export function search(tasks: readonly Task[], query: string): Task[] {
  return tasks.filter((t) => t.title.includes(query))
}
