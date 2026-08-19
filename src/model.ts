/** 태스크 한 건 */
export interface Task {
  id: number
  title: string
  done: boolean
  createdAt: string
}

export function createTask(id: number, title: string): Task {
  return { id, title, done: false, createdAt: new Date().toISOString() }
}
