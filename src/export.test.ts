import { describe, expect, it } from 'vitest'
import { toCsv } from './export'

describe('toCsv', () => {
  it('쉼표가 든 제목을 따옴표로 감싼다', () => {
    const csv = toCsv([{ id: 1, title: 'a,b', done: false, createdAt: '' }])
    expect(csv).toContain('"a,b"')
  })
})
