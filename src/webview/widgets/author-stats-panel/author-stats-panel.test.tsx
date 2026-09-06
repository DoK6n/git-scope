// @vitest-environment jsdom
import { render } from 'solid-js/web'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BridgeRequest } from '@shared-types/messages'

const sent: BridgeRequest[] = []
let statsResponse: 'success' | 'empty' | 'error' = 'success'

function respond(id: number, result: unknown): void {
  window.dispatchEvent(
    new MessageEvent('message', { data: { kind: 'response', id, ok: true, result } }),
  )
}

function reject(id: number, error: string): void {
  window.dispatchEvent(
    new MessageEvent('message', { data: { kind: 'response', id, ok: false, error } }),
  )
}

vi.stubGlobal('acquireVsCodeApi', () => ({
  postMessage: (message: BridgeRequest) => {
    sent.push(message)
    if (message.command === 'getGraph') {
      setTimeout(
        () =>
          respond(message.id, {
            commits: [],
            refs: [],
            headHash: null,
            headBranch: null,
            uncommittedCount: 0,
            moreAvailable: false,
            worktreeBranches: [],
          }),
        0,
      )
    } else if (message.command === 'getAuthorStats') {
      setTimeout(() => {
        if (statsResponse === 'error') reject(message.id, 'fatal: history unavailable')
        else if (statsResponse === 'empty') respond(message.id, [])
        else
          respond(message.id, [
            { name: 'Kim', email: 'kim@example.com', commits: 4, commitHash: 'kim-hash' },
            { name: 'Alice', email: 'alice@example.com', commits: 2, commitHash: 'alice-hash' },
          ])
      }, 0)
    } else if (message.command === 'getAvatar') {
      setTimeout(() => {
        respond(message.id, { dataUri: 'data:image/png;base64,iVBORw0KGgo=' })
      }, 0)
    } else if (message.command === 'notify') {
      setTimeout(() => respond(message.id, { ok: true }), 0)
    }
  },
}))

;(window as unknown as { __GITSCOPE_SETTINGS__: unknown }).__GITSCOPE_SETTINGS__ = {
  initialLoadCommits: 300,
  loadMoreCommits: 100,
  dateType: 'author',
  fetchPruneByDefault: false,
  language: 'en',
}

const { authorStatsStore } = await import('../../features/author-stats')
const { graphStore } = await import('../../entities/graph')
const { AuthorStatsPanel } = await import('./index')

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe('AuthorStatsPanel', () => {
  let dispose: () => void

  beforeEach(async () => {
    sent.length = 0
    statsResponse = 'success'
    authorStatsStore.closePanel()
    document.body.innerHTML = '<div id="root"></div>'
    dispose = render(() => <AuthorStatsPanel />, document.getElementById('root')!)
    await graphStore.switchRepo('/fake/repo')
  })

  afterEach(() => {
    authorStatsStore.closePanel()
    dispose()
  })

  it('전체 히스토리 기준을 알리고 범위 변경·빈 결과·요청 실패를 표시한다', async () => {
    await authorStatsStore.togglePanel()

    expect(document.querySelector('.author-stats-controls p')?.textContent).toContain(
      'complete Git history',
    )
    expect(document.querySelector('.author-stats-list')?.textContent).toContain('Kim')
    expect(document.querySelector('.author-stats-list')?.textContent).toContain('4 commits')
    await flush()
    await flush()
    expect(document.querySelectorAll('.author-stats-item .author-avatar')).toHaveLength(2)
    expect(sent.find((message) => message.command === 'getAvatar')?.params).toEqual({
      repo: '/fake/repo',
      email: 'kim@example.com',
      commitHash: 'kim-hash',
    })
    expect(sent.find((message) => message.command === 'getAuthorStats')?.params).toEqual({
      repo: '/fake/repo',
      scope: 'currentBranch',
      period: 'all',
    })

    statsResponse = 'empty'
    const selects = document.querySelectorAll<HTMLSelectElement>('.author-stats-controls select')
    selects[0]!.value = 'allRefs'
    selects[0]!.dispatchEvent(new Event('change', { bubbles: true }))
    await flush()
    await flush()
    expect(document.querySelector('.author-stats-list')?.textContent).toContain(
      'No commits in this range',
    )

    statsResponse = 'error'
    selects[1]!.value = '30d'
    selects[1]!.dispatchEvent(new Event('change', { bubbles: true }))
    await flush()
    await flush()
    expect(document.querySelector('.author-stats-error')?.textContent).toBe(
      'fatal: history unavailable',
    )
  })
})
