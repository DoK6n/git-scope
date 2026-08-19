import { describe, expect, it } from 'vitest'
import { createTask } from './model'
import { searchIgnoreCase } from './search'

describe('searchIgnoreCase', () => {
  it('대소문자 구분 없이 매칭', () => {
    const tasks = [createTask(1, 'Buy Milk')]
    expect(searchIgnoreCase(tasks, 'milk')).toHaveLength(1)
  })
})
