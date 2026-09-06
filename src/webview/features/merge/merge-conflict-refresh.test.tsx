// @vitest-environment jsdom
import { render } from 'solid-js/web'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GraphData } from '@shared-types/domain'
import type { BridgeRequest } from '@shared-types/messages'

const sent: BridgeRequest[] = []
let graphAfterAction: GraphData = emptyGraph()

function emptyGraph(): GraphData {
  return {
    commits: [],
    refs: [],
    headHash: null,
    headBranch: 'main',
    headUpstream: null,
    uncommittedCount: 0,
    operation: null,
    moreAvailable: false,
    worktreeBranches: [],
  }
}

function conflictGraph(): GraphData {
  return {
    ...emptyGraph(),
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
        author: 'Test',
        authorEmail: 'test@example.com',
        authorDate: 1,
        commitDate: 1,
        subject: 'base',
      },
    ],
    headHash: 'head',
    operation: { type: 'merge' as const, conflictCount: 2 },
    uncommittedCount: 2,
  }
}

function respond(id: number, result: unknown): void {
  window.dispatchEvent(
    new MessageEvent('message', { data: { kind: 'response', id, ok: true, result } }),
  )
}

vi.stubGlobal('acquireVsCodeApi', () => ({
  postMessage: (message: BridgeRequest) => {
    sent.push(message)
    if (message.command === 'getGraph') {
      setTimeout(() => respond(message.id, graphAfterAction), 0)
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
  language: 'en',
}

const { graphStore } = await import('../../entities/graph')
const { PromptHost } = await import('../../shared/ui')
const { GraphView } = await import('../../widgets/graph-view')
const { mergeInto } = await import('./index')

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

describe('merge conflict refresh', () => {
  let dispose: () => void

  beforeEach(async () => {
    graphAfterAction = emptyGraph()
    sent.length = 0
    document.body.innerHTML = '<div id="root"></div>'
    dispose = render(
      () => (
        <>
          <PromptHost />
          <GraphView />
        </>
      ),
      document.getElementById('root')!,
    )
    await graphStore.switchRepo('/fake/repo')
    sent.length = 0
  })

  afterEach(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    dispose()
    graphStore.setError(null)
  })

  it('merge 충돌 실패 뒤 오류를 노출하고 operation 그래프를 즉시 갱신한다', async () => {
    const done = mergeInto('feature/conflict')
    await flush()
    const confirm = [...document.querySelectorAll<HTMLButtonElement>('.dialog-footer button')]
      .find((button) => button.textContent === 'Merge')!
    confirm.click()
    await flush()

    const mergeRequest = sent.find((message) => message.command === 'merge')!
    graphAfterAction = conflictGraph()
    respond(mergeRequest.id, { ok: false, error: 'CONFLICT (content): merge failed' })
    await done
    await flush()

    const mergeIndex = sent.indexOf(mergeRequest)
    expect(sent.slice(mergeIndex + 1).some((message) => message.command === 'getGraph')).toBe(true)
    expect(graphStore.graph()?.operation).toEqual({ type: 'merge', conflictCount: 2 })
    expect(document.querySelector('.operation-badge')?.textContent).toBe('merging')
    expect(document.querySelector('.conflict-count')?.textContent).toBe('2 conflicts')
    const notification = sent.find((message) => message.command === 'notify')
    expect(notification?.params).toEqual({
      message: 'CONFLICT (content): merge failed',
      level: 'error',
    })
  })
})
