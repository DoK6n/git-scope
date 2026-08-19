import type { Task } from './model'

/** 인메모리 저장소 — 파일 영속화는 별도 PR에서 */
export class TaskStore {
  private tasks: Task[] = []

  add(task: Task): void {
    this.tasks.push(task)
  }

  list(): readonly Task[] {
    return this.tasks
  }
}
