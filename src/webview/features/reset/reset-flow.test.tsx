// @vitest-environment jsdom
import { render } from 'solid-js/web'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BridgeRequest } from '@shared-types/messages'

/**
 * reset 흐름 회귀 테스트:
 * 다이얼로그 열림 → 모드 선택(hard 경고) → 확인 → host로 reset 요청 → 성공 시 그래프 재조회.
 * bridge는 acquireVsCodeApi를 모킹해 요청을 가로채고 응답을 주입한다.
 */

const sent: BridgeRequest[] = []

function respond(id: number, result: unknown) {
  window.dispatchEvent(
    new MessageEvent('message', {
      data: { kind: 'response', id, ok: true, result },
    }),
  )
}

const EMPTY_GRAPH = {
  commits: [],
  refs: [],
  headHash: null,
  headBranch: 'main',
  uncommittedCount: 0,
  moreAvailable: false,
  worktreeBranches: [],
}

// bridge/graphStore 모듈 로드 전에 webview 전역을 준비한다
vi.stubGlobal('acquireVsCodeApi', () => ({
  postMessage: (message: BridgeRequest) => {
    sent.push(message)
    // getGraph는 자동 응답 (refresh 검증용)
    if (message.command === 'getGraph') {
      setTimeout(() => respond(message.id, EMPTY_GRAPH), 0)
    }
  },
}))
;(window as unknown as { __GITSCOPE_SETTINGS__: unknown }).__GITSCOPE_SETTINGS__ = {
  initialLoadCommits: 300,
  loadMoreCommits: 100,
  dateType: 'author',
  fetchPruneByDefault: false,
}

const { PromptHost } = await import('../../shared/ui')
const { resetToCommit, resetHeadN, undoCommitsFrom } = await import('./index')
const { graphStore } = await import('../../entities/graph')

function flush(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0))
}

describe('reset 흐름', () => {
  let dispose: () => void

  beforeEach(() => {
    sent.length = 0
    document.body.innerHTML = '<div id="root"></div>'
    dispose = render(() => <PromptHost />, document.getElementById('root')!)
  })

  afterEach(() => dispose())

  it('커밋 reset: 다이얼로그 → hard 선택 시 경고 → 확인 → reset 요청 → 그래프 재조회', async () => {
    const done = resetToCommit('abcdef1234567890')

    await flush()
    // repo가 없으면 다이얼로그 없이 종료된다 — 이 시점엔 다이얼로그가 떠 있어야 함
    // (repo는 아래에서 세팅; 우선 dialog 유무로 분기 확인)
    const dialog = document.querySelector('.dialog')
    if (!dialog) {
      // currentRepo가 null이라 조기 리턴한 경우 — 이것이 곧 버그 재현
      await done
      expect.fail('currentRepo가 null이면 reset 다이얼로그가 아예 열리지 않는다')
    }
  })

  it('repo가 설정된 상태에서 hard reset 전체 흐름', async () => {
    // switchRepo로 currentRepo 세팅 (getGraph는 자동 응답)
    await graphStore.switchRepo('/fake/repo')
    sent.length = 0

    const done = resetToCommit('abcdef1234567890')
    await flush()

    const dialog = document.querySelector('.dialog')
    expect(dialog, '다이얼로그가 열려야 한다').toBeTruthy()

    // 기본값 mixed — 경고 없음
    expect(document.querySelector('.dialog-warning')).toBeNull()

    // --hard 라디오 선택
    const radios = [...document.querySelectorAll<HTMLInputElement>('input[type=radio]')]
    expect(radios.length).toBe(3)
    radios[2]!.click()
    await flush()
    expect(document.querySelector('.dialog-warning'), 'hard 경고 표시').toBeTruthy()

    // Reset 버튼 클릭 (footer의 danger/primary 버튼)
    const buttons = [...document.querySelectorAll<HTMLButtonElement>('.dialog-footer button')]
    const confirmBtn = buttons.find((b) => b.textContent === 'Reset')!
    confirmBtn.click()
    await flush()

    // host로 reset 요청이 갔는지
    const resetReq = sent.find((m) => m.command === 'reset')
    expect(resetReq, 'reset 요청 전송').toBeTruthy()
    expect(resetReq!.params).toEqual({
      repo: '/fake/repo',
      to: 'abcdef1234567890',
      mode: 'hard',
    })

    // 성공 응답 → 그래프 재조회(getGraph)까지
    respond(resetReq!.id, { ok: true })
    await flush()
    await flush()
    expect(sent.some((m) => m.command === 'getGraph'), '성공 후 그래프 재조회').toBe(true)
    await done
  })

  it('커밋 undo: 부모 커밋으로 reset 한다 (git reset HEAD~1 상당)', async () => {
    await graphStore.switchRepo('/fake/repo')
    sent.length = 0

    const done = undoCommitsFrom('childhash1234567', ['parenthash7654321'])
    await flush()

    const confirmBtn = [...document.querySelectorAll<HTMLButtonElement>('.dialog-footer button')]
      .find((b) => b.textContent === 'Undo')!
    confirmBtn.click()
    await flush()

    const resetReq = sent.find((m) => m.command === 'reset')
    expect(resetReq).toBeTruthy()
    // 클릭한 커밋이 아니라 그 부모로 reset해야 커밋이 되돌려진다
    expect(resetReq!.params).toEqual({
      repo: '/fake/repo',
      to: 'parenthash7654321',
      mode: 'mixed',
    })
    respond(resetReq!.id, { ok: true })
    await done
  })

  it('루트 커밋 undo는 에러 안내 후 중단된다', async () => {
    await graphStore.switchRepo('/fake/repo')
    sent.length = 0
    await undoCommitsFrom('roothash', [])
    expect(sent.some((m) => m.command === 'reset')).toBe(false)
    expect(graphStore.error()).toContain('루트 커밋')
    graphStore.setError(null)
  })

  it('HEAD~N reset: N 입력이 타겟에 반영된다', async () => {
    await graphStore.switchRepo('/fake/repo')
    sent.length = 0

    const done = resetHeadN()
    await flush()

    const numberInput = document.querySelector<HTMLInputElement>('input[type=number]')
    expect(numberInput).toBeTruthy()
    numberInput!.value = '3'
    numberInput!.dispatchEvent(new Event('input', { bubbles: true }))
    await flush()

    const confirmBtn = [...document.querySelectorAll<HTMLButtonElement>('.dialog-footer button')]
      .find((b) => b.textContent === 'Reset')!
    confirmBtn.click()
    await flush()

    const resetReq = sent.find((m) => m.command === 'reset')
    expect(resetReq).toBeTruthy()
    expect(resetReq!.params).toEqual({ repo: '/fake/repo', to: 'HEAD~3', mode: 'mixed' })
    respond(resetReq!.id, { ok: true })
    await done
  })
})
