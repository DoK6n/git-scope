import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')

function rule(selector: string): string {
  const start = styles.indexOf(selector)
  if (start < 0) return ''
  const end = styles.indexOf('}', start)
  return styles.slice(start, end + 1)
}

describe('stash panel layout', () => {
  it('패널 폭을 넓히되 좁은 화면을 넘지 않는다', () => {
    const panel = rule('.worktree-panel.stash-panel {')
    expect(panel).toContain('width: 560px')
    expect(panel).toContain('max-width: calc(100% - 20px)')
  })

  it('스태시 정보는 한 줄이고 긴 메시지는 말줄임한다', () => {
    const item = rule('.stash-item {')
    const subject = rule('.stash-item-subject {')
    expect(item).toContain('flex-direction: row')
    expect(item).toContain('white-space: nowrap')
    expect(subject).toContain('overflow: hidden')
    expect(subject).toContain('text-overflow: ellipsis')
  })

  it('헤더와 인라인 액션은 일관된 SVG 아이콘 버튼 크기를 사용한다', () => {
    const headerButton = rule('.stash-header-btn {')
    const rowButton = rule('.stash-action-btn {')
    expect(headerButton).toContain('width: 26px')
    expect(headerButton).toContain('height: 26px')
    expect(rowButton).toContain('width: 24px')
    expect(rowButton).toContain('height: 24px')
  })

  it('평상시에는 액션 공간을 쓰지 않고 hover나 focus에서만 표시한다', () => {
    const actions = rule('.stash-inline-actions {')
    const revealed = rule('.stash-entry:hover .stash-inline-actions,')
    expect(actions).toContain('display: none')
    expect(actions).not.toContain('visibility: hidden')
    expect(revealed).toContain('display: inline-flex')
  })
})
