// @vitest-environment jsdom
import { render } from 'solid-js/web'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BridgeRequest } from '@shared-types/messages'

const sent: BridgeRequest[] = []

function respond(id: number, result: unknown) {
  window.dispatchEvent(
    new MessageEvent('message', {
      data: { kind: 'response', id, ok: true, result },
    }),
  )
}

const GRAPH = {
  commits: [
    {
      hash: '*',
      parents: ['head'],
      author: '',
      authorEmail: '',
      authorDate: 2,
      commitDate: 2,
      subject: 'Uncommitted changes (2)',
      isUncommitted: true,
    },
    {
      hash: 'head',
      parents: [],
      author: 'Author',
      authorEmail: 'a@example.com',
      authorDate: 1,
      commitDate: 1,
      subject: 'base',
    },
  ],
  refs: [],
  headHash: 'head',
  headBranch: 'main',
  uncommittedCount: 2,
  operation: { type: 'merge' as const, conflictCount: 2 },
  moreAvailable: false,
  worktreeBranches: [],
}

vi.stubGlobal('acquireVsCodeApi', () => ({
  postMessage: (message: BridgeRequest) => {
    sent.push(message)
    if (message.command === 'getGraph') setTimeout(() => respond(message.id, GRAPH), 0)
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
  language: 'en',
}

const { PromptHost } = await import('../../shared/ui')
const { setLocale } = await import('../../shared/lib')
const { GraphView } = await import('../../widgets/graph-view')
const { graphStore } = await import('../../entities/graph')

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe('충돌 작업 Abort UI 흐름', () => {
  let dispose: () => void

  beforeEach(async () => {
    sent.length = 0
    setLocale('en')
    document.body.innerHTML = '<div id="root"></div>'
    await graphStore.switchRepo('/fake/repo')
    dispose = render(
      () => (
        <>
          <PromptHost />
          <GraphView />
        </>
      ),
      document.getElementById('root')!,
    )
    sent.length = 0
  })

  afterEach(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    dispose()
  })

  it('작업·충돌 수를 표시하고 확인 뒤에만 abort 요청과 그래프 재조회를 실행한다', async () => {
    expect(document.querySelector('.commit-row.uncommitted.operation-in-progress')).toBeTruthy()
    expect(document.querySelector('.operation-badge')?.textContent).toBe('merging')
    expect(document.querySelector('.conflict-count')?.textContent).toBe('2 conflicts')

    document.querySelector<HTMLButtonElement>('.conflict-abort-btn')!.click()
    await flush()

    expect(document.querySelector('.dialog-title')?.textContent).toBe('Abort merging?')
    expect(sent.some((message) => message.command === 'abortOperation')).toBe(false)

    const confirm = [...document.querySelectorAll<HTMLButtonElement>('.dialog-footer button')]
      .find((button) => button.textContent === 'Abort')!
    expect(document.activeElement).not.toBe(confirm)
    confirm.click()
    await flush()

    const request = sent.find((message) => message.command === 'abortOperation')
    expect(request?.params).toEqual({ repo: '/fake/repo', operation: 'merge' })
    respond(request!.id, { ok: true })
    await flush()
    await flush()
    expect(sent.some((message) => message.command === 'getGraph')).toBe(true)
  })

  it('한국어 locale에서 작업 뱃지를 번역한다', async () => {
    setLocale('ko')
    await flush()
    expect(document.querySelector('.operation-badge')?.textContent).toBe('머지 중')
    expect(document.querySelector('.conflict-count')?.textContent).toBe('충돌 2개')
    expect(document.querySelector('.conflict-abort-btn')?.textContent).toBe('중단')
  })

  it('git 실패 시 stderr를 오류 다이얼로그에 그대로 표시한다', async () => {
    document.querySelector<HTMLButtonElement>('.conflict-abort-btn')!.click()
    await flush()
    const confirm = [...document.querySelectorAll<HTMLButtonElement>('.dialog-footer button')]
      .find((button) => button.textContent === 'Abort')!
    confirm.click()
    await flush()

    const request = sent.find((message) => message.command === 'abortOperation')!
    respond(request.id, { ok: false, error: 'fatal: no merge to abort' })
    await flush()
    expect(document.querySelector('.dialog-error-message')?.textContent).toBe(
      'fatal: no merge to abort',
    )
  })
})
