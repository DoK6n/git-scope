import { describe, expect, it } from 'vitest'
import { createTask } from './model'
import { TaskStore } from './store'

describe('TaskStore', () => {
  it('추가한 순서대로 나열한다', () => {
    const store = new TaskStore()
    store.add(createTask(1, 'a'))
    store.add(createTask(2, 'b'))
    expect(store.list().map((t) => t.id)).toEqual([1, 2])
  })
})
