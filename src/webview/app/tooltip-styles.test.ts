import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')

function rule(selector: string): string {
  const start = styles.indexOf(selector)
  if (start < 0) return ''
  const end = styles.indexOf('}', start)
  return styles.slice(start, end + 1)
}

describe('custom tooltip placement', () => {
  it('라인 통계의 여러 줄 한글 툴팁에 읽을 수 있는 너비를 준다', () => {
    const tooltip = rule('.details-line-stats[data-tip]::after {')
    expect(tooltip).toContain('width: max-content')
    expect(tooltip).toContain('max-width: min(360px, calc(100vw - 24px))')
    expect(tooltip).toContain('white-space: pre-line')
    expect(tooltip).toContain('word-break: keep-all')
  })

  it('마지막 스태시 행의 액션 툴팁은 버튼 위로 연다', () => {
    const tooltip = rule('.stash-entry:last-child .stash-action-btn[data-tip]::after {')
    expect(tooltip).toContain('top: auto')
    expect(tooltip).toContain('bottom: calc(100% + 5px)')
  })
})
