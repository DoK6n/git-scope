// @vitest-environment jsdom
import { render } from 'solid-js/web'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GitRef } from '@shared-types/domain'
import type { BridgeRequest } from '@shared-types/messages'

const sent: BridgeRequest[] = []
const repoRefs: Record<string, GitRef[]> = {
  '/repo/a': [
    { name: 'main', hash: 'a', type: 'head' },
    { name: 'team/shared', hash: 'b', type: 'head' },
    { name: 'origin/main', hash: 'a', type: 'remote', remote: 'origin' },
    { name: 'origin/team/shared', hash: 'b', type: 'remote', remote: 'origin' },
    { name: 'origin/team/other', hash: 'c', type: 'remote', remote: 'origin' },
  ],
  '/repo/b': [
    { name: 'develop', hash: 'd', type: 'head' },
    { name: 'origin/develop', hash: 'd', type: 'remote', remote: 'origin' },
    { name: 'origin/stranger', hash: 'e', type: 'remote', remote: 'origin' },
  ],
}

function visibleRefs(request: BridgeRequest<'getGraph'>): GitRef[] {
  const refs = repoRefs[request.params.repo] ?? []
  if (!request.params.includeRemotes) return refs.filter((ref) => ref.type !== 'remote')
  if (!request.params.hideRemoteOnlyBranches) return refs
  const locals = new Set(refs.filter((ref) => ref.type === 'head').map((ref) => ref.name))
  return refs.filter(
    (ref) =>
      ref.type !== 'remote' ||
      ref.remote === undefined ||
      ref.name === `${ref.remote}/HEAD` ||
      locals.has(ref.name.slice(ref.remote.length + 1)),
  )
}

function respond(id: number, result: unknown): void {
  window.dispatchEvent(
    new MessageEvent('message', { data: { kind: 'response', id, ok: true, result } }),
  )
}

vi.stubGlobal('acquireVsCodeApi', () => ({
  postMessage: (message: BridgeRequest) => {
    sent.push(message)
    if (message.command !== 'getGraph') return
    const request = message as BridgeRequest<'getGraph'>
    setTimeout(
      () =>
        respond(message.id, {
          commits: [],
          refs: visibleRefs(request),
          headHash: null,
          headBranch: null,
          uncommittedCount: 0,
          moreAvailable: false,
          worktreeBranches: [],
        }),
      0,
    )
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
const { setLocale } = await import('../../shared/lib')
const { Toolbar } = await import('./index')

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function toggle(label: string): HTMLElement {
  return [...document.querySelectorAll<HTMLElement>('.toolbar-check')].find((element) =>
    element.textContent?.includes(label),
  )!
}

function openBranches(): void {
  if (!document.querySelector('.branch-filter-dropdown')) {
    document.querySelector<HTMLButtonElement>('.branch-select')!.click()
  }
}

describe('원격 전용 브랜치 숨김 UI 흐름', () => {
  let dispose: () => void

  beforeEach(async () => {
    document.body.innerHTML = '<div id="root"></div>'
    setLocale('en')
    await graphStore.setHideRemoteOnlyBranches(false)
    await graphStore.setShowRemotes(true)
    await graphStore.switchRepo('/repo/a')
    await graphStore.applyBranchFilter(null)
    dispose = render(() => <Toolbar />, document.getElementById('root')!)
    sent.length = 0
  })

  afterEach(() => {
    dispose()
    setLocale('en')
  })

  it('토글 시 원격 전용 선택만 allowlist에서 제거하고 목록·요청에 즉시 반영한다', async () => {
    await graphStore.applyBranchFilter([
      'main',
      'origin/main',
      'origin/team/shared',
      'origin/team/other',
    ])
    sent.length = 0
    openBranches()
    expect(document.querySelector('[title="origin/team/other"]')).toBeTruthy()

    toggle('Hide Remote-Only Branches').click()
    await flush()
    await flush()

    expect(graphStore.hideRemoteOnlyBranches()).toBe(true)
    expect(graphStore.branchFilter()).toEqual([
      'main',
      'origin/main',
      'origin/team/shared',
    ])
    const request = [...sent]
      .reverse()
      .find((message) => message.command === 'getGraph') as BridgeRequest<'getGraph'>
    expect(request.params).toMatchObject({
      repo: '/repo/a',
      branches: ['main', 'origin/main', 'origin/team/shared'],
      includeRemotes: true,
      hideRemoteOnlyBranches: true,
    })
    expect(document.querySelector('[title="origin/team/other"]')).toBeNull()
    expect(document.querySelector('[title="origin/team/shared"]')).toBeTruthy()
  })

  it('Show Remote Branches를 끄면 원격 전체가 빠지고 원격 전용 토글 값은 유지된다', async () => {
    await graphStore.setHideRemoteOnlyBranches(true)
    await graphStore.applyBranchFilter(['main', 'origin/main'])
    sent.length = 0
    openBranches()

    toggle('Show Remote Branches').click()
    await flush()
    await flush()

    expect(graphStore.showRemotes()).toBe(false)
    expect(graphStore.hideRemoteOnlyBranches()).toBe(true)
    expect(graphStore.branchFilter()).toEqual(['main'])
    const request = [...sent]
      .reverse()
      .find((message) => message.command === 'getGraph') as BridgeRequest<'getGraph'>
    expect(request.params).toMatchObject({
      branches: ['main'],
      includeRemotes: false,
      hideRemoteOnlyBranches: true,
    })
  })

  it('저장소 전환 시 토글은 유지하고 allowlist는 초기화해 새 refs에 다시 적용한다', async () => {
    await graphStore.setHideRemoteOnlyBranches(true)
    await graphStore.applyBranchFilter(['main'])
    sent.length = 0

    await graphStore.switchRepo('/repo/b')

    expect(graphStore.hideRemoteOnlyBranches()).toBe(true)
    expect(graphStore.branchFilter()).toBeNull()
    const request = [...sent]
      .reverse()
      .find((message) => message.command === 'getGraph') as BridgeRequest<'getGraph'>
    expect(request.params).toMatchObject({
      repo: '/repo/b',
      branches: null,
      hideRemoteOnlyBranches: true,
    })
    openBranches()
    expect(document.querySelector('[title="origin/develop"]')).toBeTruthy()
    expect(document.querySelector('[title="origin/stranger"]')).toBeNull()
  })

  it('두 토글의 한글 라벨과 설명을 제공한다', async () => {
    setLocale('ko')
    openBranches()
    await flush()
    expect(toggle('원격 브랜치 표시').getAttribute('title')).toBe(
      '원격 브랜치를 그래프에 표시',
    )
    expect(toggle('원격에만 있는 브랜치 숨기기').getAttribute('title')).toBe(
      '대응하는 로컬 브랜치가 없는 원격 브랜치 숨기기',
    )
  })
})
