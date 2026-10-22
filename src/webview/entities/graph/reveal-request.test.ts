// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BridgeRequest } from '@shared-types/messages'

function commit(hash: string) {
  return {
    hash,
    parents: [],
    author: 'Author',
    authorEmail: 'author@example.com',
    authorDate: 1,
    commitDate: 1,
    subject: hash,
  }
}

const graphs: Record<string, unknown> = {
  '/repo/a': { commits: [commit('a-1')], refs: [], headHash: 'a-1', headBranch: 'main', uncommittedCount: 0, moreAvailable: false, worktreeBranches: [] },
  '/repo/b': { commits: [commit('b-1'), commit('b-2')], refs: [], headHash: 'b-1', headBranch: 'main', uncommittedCount: 0, moreAvailable: false, worktreeBranches: [] },
}

let revealTarget: { repo: string; hash: string } | null = null
const notices: string[] = []

function respond(id: number, result: unknown): void {
  window.dispatchEvent(new MessageEvent('message', { data: { kind: 'response', id, ok: true, result } }))
}

vi.stubGlobal('acquireVsCodeApi', () => ({
  postMessage: (message: BridgeRequest) => {
    const params = message.params as Record<string, unknown>
    let result: unknown = { ok: true }
    if (message.command === 'listRepos') result = [{ root: '/repo/a', name: 'a' }, { root: '/repo/b', name: 'b' }]
    if (message.command === 'getGraph') result = graphs[params.repo as string]
    if (message.command === 'notify') notices.push(params.message as string)
    if (message.command === 'takeRevealRequest') {
      result = revealTarget
      revealTarget = null
    }
    setTimeout(() => respond(message.id, result), 0)
  },
}))
;(window as unknown as { __GITSCOPE_SETTINGS__: unknown }).__GITSCOPE_SETTINGS__ = {
  initialLoadCommits: 300,
  loadMoreCommits: 100,
  dateType: 'author',
  fetchPruneByDefault: false,
  language: 'en',
}

const { graphStore } = await import('./index')

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe('reveal requests from the editor', () => {
  beforeEach(async () => {
    notices.length = 0
    await graphStore.loadRepos()
    await graphStore.switchRepo('/repo/a')
  })

  it('switches to the requested repository and selects the commit', async () => {
    revealTarget = { repo: '/repo/b', hash: 'b-2' }
    await graphStore.consumeRevealRequest()

    expect(graphStore.currentRepo()).toBe('/repo/b')
    expect(graphStore.selectedCommit()).toBe('b-2')
  })

  it('handles the revealRequested event sent to an open panel', async () => {
    revealTarget = { repo: '/repo/a', hash: 'a-1' }
    window.dispatchEvent(new MessageEvent('message', { data: { kind: 'event', event: 'revealRequested' } }))
    for (let i = 0; i < 5; i++) await flush()

    expect(graphStore.selectedCommit()).toBe('a-1')
  })

  it('tells the user when the repository is not open', async () => {
    revealTarget = { repo: '/elsewhere', hash: 'x' }
    await graphStore.consumeRevealRequest()

    expect(graphStore.currentRepo()).toBe('/repo/a')
    expect(notices).toEqual(['This repository is not open in Git Scope.'])
  })

  it('does nothing when no request is pending', async () => {
    await graphStore.consumeRevealRequest()
    expect(graphStore.selectedCommit()).toBeNull()
  })
})
