// @vitest-environment jsdom
import { render } from 'solid-js/web'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BridgeRequest } from '@shared-types/messages'

/**
 * GraphView drag-to-reset 이벤트 배선 통합 테스트:
 * 히트 서클 렌더링 → HEAD 히트 서클 mousedown → mousemove(임계 초과) →
 * 미리보기 plan 반영 → mouseup → 확인 다이얼로그. hover 확대도 함께 검증한다.
 */

const sent: BridgeRequest[] = []

function respond(id: number, result: unknown) {
  window.dispatchEvent(
    new MessageEvent('message', { data: { kind: 'response', id, ok: true, result } }),
  )
}

// 선형 히스토리 H1(HEAD) → H2 → H3 → H4, 행 높이 26px
const commit = (hash: string, parents: string[]) => ({
  hash,
  parents,
  author: 'a',
  authorEmail: 'a@x',
  authorDate: 0,
  commitDate: 0,
  subject: `subject ${hash}`,
})
const GRAPH = {
  commits: [commit('H1', ['H2']), commit('H2', ['H3']), commit('H3', ['H4']), commit('H4', [])],
  refs: [{ name: 'main', hash: 'H1', type: 'head' }],
  headHash: 'H1',
  headBranch: 'main',
  uncommittedCount: 0,
  moreAvailable: false,
  worktreeBranches: [],
}

vi.stubGlobal('acquireVsCodeApi', () => ({
  postMessage: (message: BridgeRequest) => {
    sent.push(message)
    if (message.command === 'getGraph') {
      setTimeout(() => respond(message.id, GRAPH), 0)
    }
  },
}))
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    disconnect() {}
  },
)
;(window as unknown as { __GITSCOPE_SETTINGS__: unknown }).__GITSCOPE_SETTINGS__ = {
  initialLoadCommits: 300,
  loadMoreCommits: 100,
  dateType: 'author',
  fetchPruneByDefault: false,
}

const { PromptHost } = await import('../../shared/ui')
const { GraphView } = await import('./ui/GraphView')
const { dragResetStore } = await import('../../features/reset')
const { graphStore } = await import('../../entities/graph')

function flush(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0))
}

function mouse(type: string, init: MouseEventInit = {}): MouseEvent {
  return new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, ...init })
}

describe('GraphView drag-to-reset 배선', () => {
  let dispose: () => void

  beforeEach(async () => {
    sent.length = 0
    dragResetStore.clear()
    document.body.innerHTML = '<div id="root"></div>'
    await graphStore.switchRepo('/fake/repo')
    dispose = render(
      () => (
        <>
          <GraphView />
          <PromptHost />
        </>
      ),
      document.getElementById('root')!,
    )
    await flush()
  })

  afterEach(() => {
    dispose()
    graphStore.setSelectedCommit(null)
  })

  it('모든 커밋 점 위에 히트 서클이 있고 HEAD 것만 head-node다', () => {
    const hits = document.querySelectorAll('.graph-node-hit')
    expect(hits.length).toBe(4)
    const headHits = document.querySelectorAll('.graph-node-hit.head-node')
    expect(headHits.length).toBe(1)
  })

  it('히트 서클 hover 시 해당 점만 확대된다', () => {
    const hits = [...document.querySelectorAll('.graph-node-hit')]
    // mouseenter는 위임되지 않으므로 직접 dispatch (bubbles: false가 실제와 같다)
    hits[1]!.dispatchEvent(new MouseEvent('mouseenter'))
    const nodes = [...document.querySelectorAll<SVGCircleElement>('.graph-node')]
    expect(nodes[1]!.getAttribute('r')).toBe('6.5')
    expect(nodes[0]!.getAttribute('r')).toBe('4')
    expect(nodes[2]!.getAttribute('r')).toBe('4')
    hits[1]!.dispatchEvent(new MouseEvent('mouseleave'))
    expect(nodes[1]!.getAttribute('r')).toBe('4')
  })

  it('HEAD 히트 서클 mousedown → 드래그 → 미리보기 → mouseup → 다이얼로그', async () => {
    const headHit = document.querySelector('.graph-node-hit.head-node')!
    // 행 0 중앙(y=13)에서 누르고 행 2(y=65)까지 끈다 — jsdom의 rect는 전부 0이라 clientY가 곧 캔버스 y
    headHit.dispatchEvent(mouse('mousedown', { clientY: 13 }))
    window.dispatchEvent(mouse('mousemove', { clientY: 65 }))

    const plan = dragResetStore.plan()
    expect(plan, '드래그 중 미리보기 plan이 만들어져야 한다').toBeTruthy()
    expect(plan!.erased.map((c) => c.hash)).toEqual(['H1', 'H2'])
    expect(plan!.target.hash).toBe('H3')

    // 미리보기가 행에 반영된다
    expect(document.querySelectorAll('.commit-row.doomed').length).toBe(2)
    expect(document.querySelectorAll('.commit-row.new-head').length).toBe(1)

    window.dispatchEvent(mouse('mouseup', { clientY: 65 }))
    await flush()
    expect(document.querySelector('.dialog'), 'mouseup 시 확인 다이얼로그').toBeTruthy()
    expect(document.querySelectorAll('.dialog-list-item').length).toBe(2)
    // 다이얼로그가 떠 있는 동안 미리보기 유지
    expect(dragResetStore.plan()).toBeTruthy()

    const cancelBtn = [...document.querySelectorAll<HTMLButtonElement>('.dialog-footer button')]
      .find((b) => b.textContent === 'Cancel')!
    cancelBtn.click()
    await flush()
    expect(dragResetStore.plan()).toBeNull()
  })

  it('움직이지 않아도 꾹 누르면(HOLD_DELAY) 드래그 모드로 진입한다', async () => {
    vi.useFakeTimers()
    try {
      const headHit = document.querySelector('.graph-node-hit.head-node')!
      headHit.dispatchEvent(mouse('mousedown', { clientY: 13 }))
      vi.advanceTimersByTime(350)
      // 이동 없이도 드래그 모드 — 이후 1px만 움직여도 임계와 무관하게 plan이 갱신된다
      window.dispatchEvent(mouse('mousemove', { clientY: 40 }))
      expect(dragResetStore.plan()?.erased.map((c) => c.hash)).toEqual(['H1'])
      window.dispatchEvent(mouse('mouseup', { clientY: 40 }))
    } finally {
      vi.useRealTimers()
    }
    await flush()
    const cancelBtn = [...document.querySelectorAll<HTMLButtonElement>('.dialog-footer button')]
      .find((b) => b.textContent === 'Cancel')
    cancelBtn?.click()
  })

  it('확인 다이얼로그는 Esc로 닫힌다 — 취소와 동일하게 reset 없이 미리보기만 지운다', async () => {
    const headHit = document.querySelector('.graph-node-hit.head-node')!
    headHit.dispatchEvent(mouse('mousedown', { clientY: 13 }))
    window.dispatchEvent(mouse('mousemove', { clientY: 65 }))
    window.dispatchEvent(mouse('mouseup', { clientY: 65 }))
    await flush()
    expect(document.querySelector('.dialog')).toBeTruthy()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flush()
    expect(document.querySelector('.dialog')).toBeNull()
    expect(dragResetStore.plan()).toBeNull()
    expect(sent.some((m) => m.command === 'reset')).toBe(false)
  })

  it('Escape로 드래그를 취소하면 미리보기가 사라진다', () => {
    const headHit = document.querySelector('.graph-node-hit.head-node')!
    headHit.dispatchEvent(mouse('mousedown', { clientY: 13 }))
    window.dispatchEvent(mouse('mousemove', { clientY: 65 }))
    expect(dragResetStore.plan()).toBeTruthy()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(dragResetStore.plan()).toBeNull()
    window.dispatchEvent(mouse('mouseup', { clientY: 65 }))
    expect(document.querySelector('.dialog')).toBeNull()
  })

  it('리셋 드래그 중에는 라인 hover 강조가 꺼진다 — 미리보기 dim과 섞이지 않게', () => {
    // 라인 hover로 강조를 켠 상태에서 드래그를 시작하면 강조가 사라져야 한다
    const lineHit = document.querySelector('.graph-line-hit')!
    lineHit.dispatchEvent(new MouseEvent('mouseenter'))
    expect(document.querySelector('.graph-line.active')).toBeTruthy()

    const headHit = document.querySelector('.graph-node-hit.head-node')!
    headHit.dispatchEvent(mouse('mousedown', { clientY: 13 }))
    window.dispatchEvent(mouse('mousemove', { clientY: 65 }))
    expect(document.querySelector('.graph-line.active')).toBeNull()
    expect(dragResetStore.plan()).toBeTruthy()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
  })

  it('HEAD가 아닌 노드 클릭은 커밋 선택으로 동작한다', () => {
    const hits = [...document.querySelectorAll('.graph-node-hit')]
    hits[2]!.dispatchEvent(mouse('click'))
    expect(graphStore.selectedCommit()).toBe('H3')
  })
})
