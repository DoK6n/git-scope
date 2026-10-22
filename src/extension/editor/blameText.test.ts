import { describe, expect, it } from 'vitest'
import type { BlameCommit } from '../git/blame'
import { inlineBlameText, relativeTime } from './blameText'

const NOW = Date.UTC(2026, 9, 22, 12, 0, 0)
const nowSeconds = NOW / 1000

const commit: BlameCommit = {
  hash: '806f220c0396cf4cb678354f306f3c85a683dff5',
  author: 'Git Scope Test',
  authorEmail: 'test@gitscope.invalid',
  authorTime: nowSeconds - 3 * 24 * 3600,
  summary: 'feat: add inline blame',
  uncommitted: false,
}

describe('relativeTime', () => {
  it('uses the largest whole unit', () => {
    expect(relativeTime(nowSeconds - 30, NOW, 'en')).toBe('just now')
    expect(relativeTime(nowSeconds - 60, NOW, 'en')).toBe('1 minute ago')
    expect(relativeTime(nowSeconds - 5 * 3600, NOW, 'en')).toBe('5 hours ago')
    expect(relativeTime(nowSeconds - 14 * 24 * 3600, NOW, 'en')).toBe('2 weeks ago')
    expect(relativeTime(nowSeconds - 400 * 24 * 3600, NOW, 'en')).toBe('1 year ago')
  })

  it('formats Korean and clamps future timestamps', () => {
    expect(relativeTime(nowSeconds - 3 * 24 * 3600, NOW, 'ko')).toBe('3일 전')
    expect(relativeTime(nowSeconds + 3600, NOW, 'ko')).toBe('방금 전')
  })
})

describe('inlineBlameText', () => {
  it('shows author, relative time, and summary', () => {
    expect(inlineBlameText(commit, NOW, 'en')).toBe('Git Scope Test, 3 days ago • feat: add inline blame')
  })

  it('truncates long summaries', () => {
    const text = inlineBlameText({ ...commit, summary: 'x'.repeat(100) }, NOW, 'en')
    expect(text.endsWith('…')).toBe(true)
    expect(text.length).toBeLessThan(100)
  })

  it('labels uncommitted lines without an author', () => {
    expect(inlineBlameText({ ...commit, uncommitted: true }, NOW, 'ko')).toBe('커밋되지 않은 변경')
  })
})
