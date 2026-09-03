// @vitest-environment jsdom
import { render } from 'solid-js/web'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActionResult, BranchUpstream, GraphData } from '@shared-types/domain'
import type { BridgeRequest } from '@shared-types/messages'

const sent: BridgeRequest[] = []
let upstream: BranchUpstream | null = null
let headBranch: string | null = 'main'
let pullResult: ActionResult = { ok: true }

const graph = (): GraphData => ({
  commits: [],
  refs: [],
  headHash: 'head1111',
  headBranch,
  headUpstream: upstream,
  uncommittedCount: 0,
  operation: null,
  moreAvailable: false,
  worktreeBranches: [],
})

function respond(id: number, result: unknown) {
  window.dispatchEvent(new MessageEvent('message', { data: { kind: 'response', id, ok: true, result } }))
}

vi.stubGlobal('acquireVsCodeApi', () => ({
  postMessage: (message: BridgeRequest) => {
    sent.push(message)
    if (message.command === 'getGraph') setTimeout(() => respond(message.id, graph()), 0)
    if (message.command === 'pullCurrent') setTimeout(() => respond(message.id, pullResult), 0)
    if (message.command === 'notify') setTimeout(() => respond(message.id, { ok: true }), 0)
  },
}))
;(window as unknown as { __GITSCOPE_SETTINGS__: unknown }).__GITSCOPE_SETTINGS__ = {
  initialLoadCommits: 300,
  loadMoreCommits: 100,
  dateType: 'author',
  fetchPruneByDefault: false,
  language: 'en',
}

const { graphStore } = await import('../../entities/graph')
const { Toolbar } = await import('../../widgets/toolbar')

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

describe('toolbar pull', () => {
  let dispose: () => void

  beforeEach(async () => {
    upstream = null
    headBranch = 'main'
    pullResult = { ok: true }
    sent.length = 0
    graphStore.setError(null)
    document.body.innerHTML = '<div id="root"></div>'
    dispose = render(() => <Toolbar />, document.getElementById('root')!)
    await graphStore.switchRepo('/fake/repo')
    await flush()
  })

  afterEach(() => dispose())

  it('upstream이 없으면 비활성화하고 이유를 툴팁으로 표시한다', () => {
    const button = document.querySelector<HTMLButtonElement>('.toolbar-pull')!
    expect(button.disabled).toBe(true)
    expect(button.dataset.tip).toBe('Current branch has no upstream.')
  })

  it('detached HEAD이면 전용 비활성화 사유를 표시한다', async () => {
    headBranch = null
    await graphStore.refresh()
    const button = document.querySelector<HTMLButtonElement>('.toolbar-pull')!
    expect(button.disabled).toBe(true)
    expect(button.dataset.tip).toBe('Cannot pull in detached HEAD state.')
  })

  it('Fetch 바로 왼쪽에서 현재 upstream을 pull하고 성공 후 그래프를 갱신한다', async () => {
    upstream = { remote: 'origin', branch: 'main' }
    await graphStore.refresh()
    const pull = document.querySelector<HTMLButtonElement>('.toolbar-pull')!
    const fetch = document.querySelector<HTMLButtonElement>('.toolbar-fetch')!
    expect(pull.disabled).toBe(false)
    expect(pull.dataset.tip).toBe('Pull current branch from origin/main')
    expect(pull.nextElementSibling).toBe(fetch)

    const graphsBefore = sent.filter((request) => request.command === 'getGraph').length
    pull.click()
    await flush()
    await flush()
    expect(sent.find((request) => request.command === 'pullCurrent')?.params).toEqual({
      repo: '/fake/repo',
    })
    expect(sent.filter((request) => request.command === 'getGraph').length).toBeGreaterThan(graphsBefore)
  })

  it('pull 실패 시 git 오류를 그대로 노출한다', async () => {
    upstream = { remote: 'origin', branch: 'main' }
    pullResult = { ok: false, error: 'CONFLICT (content): Merge conflict in src/app.ts' }
    await graphStore.refresh()
    const graphsBefore = sent.filter((request) => request.command === 'getGraph').length
    document.querySelector<HTMLButtonElement>('.toolbar-pull')!.click()
    await flush()
    await flush()
    expect(graphStore.error()).toBe('CONFLICT (content): Merge conflict in src/app.ts')
    expect(sent.filter((request) => request.command === 'getGraph').length).toBeGreaterThan(
      graphsBefore,
    )
  })
})
