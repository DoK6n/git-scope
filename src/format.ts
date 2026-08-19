import type { Task } from './model'

/** CLI 출력 한 줄 포맷 — 목록/검색 결과가 공용으로 쓴다 */
export function formatLine(task: Task): string {
  return `${task.done ? '✔' : '·'} ${task.title}`
}
