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

import { readFileSync, writeFileSync } from 'node:fs'

export function saveToFile(store: TaskStore, path: string): void {
  writeFileSync(path, JSON.stringify(store.list(), null, 2))
}

export function loadFromFile(path: string): Task[] {
  return JSON.parse(readFileSync(path, 'utf8')) as Task[]
}

export function loadSafe(path: string): Task[] {
  try {
    return loadFromFile(path)
  } catch {
    return [] // 손상된 JSON 은 빈 목록으로 복구
  }
}
