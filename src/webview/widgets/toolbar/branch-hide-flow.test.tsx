// @vitest-environment jsdom
import { render } from 'solid-js/web'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GitRef, GraphData } from '@shared-types/domain'
import type { BridgeRequest } from '@shared-types/messages'

const sent: BridgeRequest[] = []
type GraphRequest = BridgeRequest<'getGraph'>

const refs: GitRef[] = [
  { name: 'main', hash: '1', type: 'head' },
  { name: 'feature/secret', hash: '2', type: 'head' },
  { name: 'origin/main', hash: '1', type: 'remote', remote: 'origin' },
  { name: 'origin/HEAD', hash: '1', type: 'remote', remote: 'origin' },
  { name: 'origin/topic', hash: '3', type: 'remote', remote: 'origin' },
  { name: 'v1', hash: '1', type: 'tag' },
]

function graphFor(message: GraphRequest): GraphData {
  const hidden = new Set(message.params.hiddenBranchNames)
  const localBranches = new Set(
    refs.filter((ref) => ref.type === 'head').map((ref) => ref.name),
  )
  return {
    commits: [],
    refs: refs
      .filter((ref) => {
        if (!message.params.hideRemoteOnlyBranches || ref.type !== 'remote' || !ref.remote) {
          return true
        }
        if (ref.name === `${ref.remote}/HEAD`) return true
        return localBranches.has(ref.name.slice(ref.remote.length + 1))
      })
      .filter(
        (ref) =>
          ref.type === 'tag' ||
          (ref.type === 'remote' && ref.remote && ref.name === `${ref.remote}/HEAD`) ||
          !hidden.has(ref.name),
      ),
    headHash: null,
    headBranch: 'main',
    headUpstream: null,
    uncommittedCount: 0,
    moreAvailable: false,
    worktreeBranches: [],
    operation: null,
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
      setTimeout(() => respond(message.id, graphFor(message as GraphRequest)), 0)
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

const { graphStore } = await import('../../entities/graph')
const { buildRefMenu } = await import('../graph-view/model/refMenu')
const { Toolbar } = await import('./index')

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

function lastGraphRequest(): GraphRequest {
  return sent.filter((message) => message.command === 'getGraph').at(-1) as GraphRequest
}

describe('manual branch hiding flow', () => {
  let dispose: () => void

  beforeEach(async () => {
    if (graphStore.hideRemoteOnlyBranches()) {
      await graphStore.setHideRemoteOnlyBranches(false)
    }
    sent.length = 0
    document.body.innerHTML = '<div id="root"></div>'
    dispose = render(() => <Toolbar />, document.getElementById('root')!)
  })

  afterEach(() => dispose())

  it('로컬·원격 브랜치 메뉴에만 Hide Branch 진입점을 제공한다', () => {
    expect(buildRefMenu(refs[0]!).map((item) => item.label)).toContain('Hide Branch')
    expect(buildRefMenu(refs[4]!).map((item) => item.label)).toContain('Hide Branch')
    expect(buildRefMenu(refs[3]!).map((item) => item.label)).not.toContain('Hide Branch')
    expect(buildRefMenu(refs[5]!).map((item) => item.label)).not.toContain('Hide Branch')
  })

  it('선택된 브랜치도 숨김이 우선하고 목록·개별 해제 상태가 함께 갱신된다', async () => {
    await graphStore.switchRepo('/manual-hide/filter')
    await graphStore.applyBranchFilter(['feature/secret'])

    buildRefMenu(refs[1]!).find((item) => item.label === 'Hide Branch')!.onClick()
    await flush()
    await flush()

    expect(lastGraphRequest().params).toMatchObject({
      branches: ['feature/secret'],
      hiddenBranchNames: ['feature/secret'],
    })
    expect(graphStore.branchFilter()).toEqual(['feature/secret'])

    document.querySelector<HTMLButtonElement>('.branch-select')!.click()
    await flush()
    expect(document.querySelector('.hidden-branches-head')?.textContent).toContain(
      'Hidden Branches (1)',
    )
    expect(document.querySelector('.hidden-branch-row')?.textContent).toContain('feature/secret')
    expect(document.querySelector('.branch-filter-list')?.textContent).not.toContain(
      'feature/secret',
    )

    document
      .querySelector<HTMLButtonElement>('[aria-label="Unhide Branch: feature/secret"]')!
      .click()
    await flush()
    await flush()

    expect(lastGraphRequest().params).toMatchObject({
      branches: ['feature/secret'],
      hiddenBranchNames: [],
    })
    expect(document.querySelector('.hidden-branches')).toBeNull()
    expect(document.querySelector('.branch-filter-list')?.textContent).toContain(
      'feature/secret',
    )
  })

  it('수동 blocklist를 저장소별 세션 상태로 복원하고 전체 해제를 제공한다', async () => {
    await graphStore.switchRepo('/manual-hide/repo-a')
    await graphStore.hideBranch('feature/secret')
    await graphStore.hideBranch('origin/topic')
    expect(lastGraphRequest().params.hiddenBranchNames).toEqual([
      'feature/secret',
      'origin/topic',
    ])

    await graphStore.switchRepo('/manual-hide/repo-b')
    expect(lastGraphRequest().params.hiddenBranchNames).toEqual([])

    await graphStore.switchRepo('/manual-hide/repo-a')
    expect(lastGraphRequest().params.hiddenBranchNames).toEqual([
      'feature/secret',
      'origin/topic',
    ])

    document.querySelector<HTMLButtonElement>('.branch-select')!.click()
    document.querySelector<HTMLButtonElement>('.hidden-branches-head button')!.click()
    await flush()
    await flush()
    expect(lastGraphRequest().params.hiddenBranchNames).toEqual([])
  })

  it('원격 전용 필터와 함께 써도 숨긴 로컬의 대응 원격은 유지한다', async () => {
    await graphStore.switchRepo('/manual-hide/combined')
    await graphStore.setHideRemoteOnlyBranches(true)
    await graphStore.hideBranch('main')

    expect(lastGraphRequest().params).toMatchObject({
      hideRemoteOnlyBranches: true,
      hiddenBranchNames: ['main'],
    })
    expect(graphStore.graph()?.refs.map((ref) => ref.name)).toContain('origin/main')
    expect(graphStore.graph()?.refs.map((ref) => ref.name)).not.toContain('origin/topic')
    expect(graphStore.graph()?.refs.map((ref) => ref.name)).not.toContain('main')
  })
})
