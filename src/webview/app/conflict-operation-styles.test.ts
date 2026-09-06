import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')

function rule(selector: string): string {
  const start = styles.indexOf(selector)
  if (start < 0) return ''
  const end = styles.indexOf('}', start)
  return styles.slice(start, end + 1)
}

describe('conflict operation styles', () => {
  it('작업 진행 행 전체에 별도 배경이나 좌측 강조를 적용하지 않는다', () => {
    expect(styles).not.toContain('.commit-row.uncommitted.operation-in-progress {')
    expect(styles).not.toContain('.commit-row.uncommitted.operation-in-progress:hover')
  })

  it('작업·충돌 뱃지는 VS Code error theme 색상을 사용한다', () => {
    const badges = rule('.operation-badge,\n.conflict-count')
    expect(badges).toContain('--vscode-inputValidation-errorBorder')
    expect(badges).toContain('--vscode-inputValidation-errorBackground')
    expect(badges).toContain('--vscode-inputValidation-errorForeground')
    expect(badges).not.toContain('--vscode-inputValidation-warning')
  })

  it('Abort는 정사각형 icon-only 버튼 레이아웃이다', () => {
    const abort = rule('.conflict-abort-btn')
    expect(abort).toContain('width: 22px')
    expect(abort).toContain('display: inline-flex')
    expect(abort).toContain('justify-content: center')
    expect(abort).toContain('border: 0')
    expect(abort).toContain('background: transparent')
  })

  it('controls는 overflow 영역 밖에 두고 메시지 바로 뒤에 배치한다', () => {
    const message = rule('.commit-row.uncommitted.operation-in-progress .col-message')
    expect(message).toContain('flex: 0 1 auto')
  })
})
