import { describe, expect, it } from 'vitest'
import { formatRelativeTime } from './format'

describe('formatRelativeTime', () => {
  const now = Date.UTC(2026, 8, 3, 12)

  it('최근 스태시를 일·주 단위로 읽기 쉽게 표시한다', () => {
    expect(formatRelativeTime(now / 1000 - 6 * 86400, now)).toBe('6 days ago')
    expect(formatRelativeTime(now / 1000 - 7 * 86400, now)).toBe('last week')
    expect(formatRelativeTime(now / 1000 - 21 * 86400, now)).toBe('3 weeks ago')
  })

  it('한 달 전 스태시는 last month로 표시한다', () => {
    expect(formatRelativeTime(now / 1000 - 30 * 86400, now)).toBe('last month')
  })
})
