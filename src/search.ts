import type { Task } from './model'

export function search(tasks: readonly Task[], query: string): Task[] {
  return tasks.filter((t) => t.title.includes(query))
}

export function searchIgnoreCase(tasks: readonly Task[], query: string): Task[] {
  const q = query.toLowerCase()
  return tasks.filter((t) => t.title.toLowerCase().includes(q))
}
