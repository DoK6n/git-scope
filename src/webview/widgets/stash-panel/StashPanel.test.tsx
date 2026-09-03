// @vitest-environment jsdom
import { render } from 'solid-js/web'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BridgeRequest } from '@shared-types/messages'

const sent: BridgeRequest[] = []
const stash = {
  hash: 'stash1111',
  selector: 'stash@{0}',
  baseHash: 'base1111',
  author: 'Test',
  authorEmail: 'test@example.com',
  authorDate: Math.floor(Date.now() / 1000) - 7 * 86400,
  commitDate: Math.floor(Date.now() / 1000) - 7 * 86400,
  subject: 'On feature/panel: keep local work',
  branch: 'feature/panel',
  message: 'keep local work',
}
const commit = (hash: string, subject: string, stashSelector?: string) => ({
  hash,
  parents: hash === stash.hash ? [stash.baseHash] : [],
  author: 'Test',
  authorEmail: 'test@example.com',
  authorDate: stash.authorDate,
  commitDate: stash.commitDate,
  subject,
  stashSelector,
})
const graph = {
  commits: [commit(stash.hash, stash.subject, stash.selector), commit(stash.baseHash, 'base')],
  refs: [],
  headHash: stash.baseHash,
  headBranch: 'main',
  uncommittedCount: 1,
  moreAvailable: false,
  worktreeBranches: [],
}

function respond(id: number, result: unknown) {
  window.dispatchEvent(new MessageEvent('message', { data: { kind: 'response', id, ok: true, result } }))
}

vi.stubGlobal('acquireVsCodeApi', () => ({
  postMessage: (message: BridgeRequest) => {
    sent.push(message)
    const responses: Partial<Record<BridgeRequest['command'], unknown>> = {
      getGraph: graph,
      listStashes: [stash],
      getStashFiles: [{
        status: 'M',
        path: 'src/panel.ts',
        additions: 3,
        deletions: 1,
        hash: stash.hash,
        baseHash: stash.baseHash,
      }],
      openDiff: { ok: true },
      notify: { ok: true },
      stashDrop: { ok: true },
      stashPop: { ok: true },
    }
    if (message.command in responses) setTimeout(() => respond(message.id, responses[message.command]), 0)
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
const { stashPanelStore } = await import('../../features/stash')
const { PromptHost } = await import('../../shared/ui')
const { StashPanel } = await import('./index')

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

describe('StashPanel enhancements', () => {
  let dispose: () => void

  beforeEach(async () => {
    sent.length = 0
    stashPanelStore.closePanel()
    document.body.innerHTML = '<div id="root"></div>'
    dispose = render(() => <><StashPanel /><PromptHost /></>, document.getElementById('root')!)
    await graphStore.switchRepo('/fake/repo')
    await stashPanelStore.togglePanel()
    await flush()
  })

  afterEach(() => {
    stashPanelStore.closePanel()
    dispose()
  })

  it('개수·브랜치·메시지를 표시하고 펼칠 때 파일을 지연 조회해 diff를 연다', async () => {
    expect(document.querySelector('.stash-header')?.textContent).toContain('Stashes (1)')
    expect(document.querySelector('.stash-branch-badge')?.textContent).toBe('feature/panel')
    expect(document.querySelector('.stash-item-subject')?.textContent).toBe('keep local work')
    expect(document.querySelector('.stash-item-date')?.textContent).toBe('last week')

    document.querySelector<HTMLButtonElement>('.stash-expand')!.click()
    await flush()
    expect(sent.find((request) => request.command === 'getStashFiles')?.params).toEqual({
      repo: '/fake/repo',
      selector: 'stash@{0}',
    })
    expect(document.querySelector('.stash-file-path')?.textContent).toBe('src/panel.ts')

    document.querySelector<HTMLButtonElement>('.stash-file')!.click()
    await flush()
    expect(sent.find((request) => request.command === 'openDiff')?.params).toMatchObject({
      repo: '/fake/repo',
      hash: stash.hash,
      baseHash: stash.baseHash,
      path: 'src/panel.ts',
    })
  })

  it('Compare는 기존 비교 상세 상태를 사용하고 Drop은 확인 전 실행하지 않는다', async () => {
    document.querySelector<HTMLButtonElement>('button[aria-label="Compare stash"]')!.click()
    expect(graphStore.selectedCommit()).toBe(stash.hash)
    expect(graphStore.compareWith()).toBe(stash.baseHash)

    const before = sent.filter((request) => request.command === 'stashDrop').length
    document.querySelector<HTMLButtonElement>('button[aria-label="Drop stash"]')!.click()
    await flush()
    expect(document.querySelector('.dialog-overlay')).toBeTruthy()
    expect(sent.filter((request) => request.command === 'stashDrop')).toHaveLength(before)
  })
})
