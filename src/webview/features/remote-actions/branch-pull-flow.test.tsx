// @vitest-environment jsdom
import { render } from 'solid-js/web'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BridgeRequest } from '@shared-types/messages'

const sent: BridgeRequest[] = []

function respond(id: number, result: unknown): void {
  window.dispatchEvent(
    new MessageEvent('message', { data: { kind: 'response', id, ok: true, result } }),
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

vi.stubGlobal('acquireVsCodeApi', () => ({
  postMessage: (message: BridgeRequest) => {
    sent.push(message)
    if (message.command === 'getGraph') setTimeout(() => respond(message.id, EMPTY_GRAPH), 0)
  },
}))
;(window as unknown as { __GITSCOPE_SETTINGS__: unknown }).__GITSCOPE_SETTINGS__ = {
  initialLoadCommits: 300,
  loadMoreCommits: 100,
  dateType: 'author',
  fetchPruneByDefault: false,
  language: 'en',
}

const { PromptHost } = await import('../../shared/ui')
const { graphStore } = await import('../../entities/graph')
const { pullLocalBranch } = await import('./index')

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function button(label: string): HTMLButtonElement {
  return [...document.querySelectorAll<HTMLButtonElement>('.dialog-footer button')].find(
    (candidate) => candidate.textContent === label,
  )!
}

function requestFor(command: BridgeRequest['command']): BridgeRequest {
  return [...sent].reverse().find((request) => request.command === command)!
}

function standardPlan(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    upstream: {
      displayName: 'upstream/review/search',
      remote: 'upstream',
      remoteRef: 'refs/heads/review/search',
    },
    ahead: 0,
    behind: 2,
    worktreePath: null,
    isCurrent: false,
    ...overrides,
  }
}

describe('pull local branch without checkout flow', () => {
  let dispose: () => void

  beforeEach(async () => {
    sent.length = 0
    document.body.innerHTML = '<div id="root"></div>'
    dispose = render(() => <PromptHost />, document.getElementById('root')!)
    await graphStore.switchRepo('/fake/repo')
    sent.length = 0
  })

  afterEach(() => dispose())

  it('uses the regular pull request when the target is the current branch', async () => {
    const done = pullLocalBranch('main')
    await flush()
    const plan = requestFor('getBranchPullPlan')
    respond(plan.id, standardPlan({ isCurrent: true }))
    await flush()

    expect(document.querySelector('.dialog-title')!.textContent).toBe(
      'Pull upstream/review/search',
    )
    button('Pull').click()
    await flush()

    const pull = requestFor('pullBranch')
    expect(pull.params).toEqual({
      repo: '/fake/repo',
      remote: 'upstream',
      branch: 'review/search',
    })
    respond(pull.id, { ok: true })
    await done
  })

  it('shows exact counts and sends the configured upstream ref without checking out', async () => {
    const done = pullLocalBranch('feat/search')
    await flush()
    const plan = requestFor('getBranchPullPlan')
    respond(plan.id, standardPlan())
    await flush()

    expect(document.querySelector('.dialog-body')!.textContent).toContain(
      'feat/search is 0 commit(s) ahead and 2 commit(s) behind upstream/review/search',
    )
    button('Pull Branch').click()
    await flush()

    const pull = requestFor('pullBranchWithoutCheckout')
    expect(pull.params).toEqual({
      repo: '/fake/repo',
      branch: 'feat/search',
      remote: 'upstream',
      remoteRef: 'refs/heads/review/search',
    })
    respond(pull.id, { ok: true })
    await done
    expect(sent.some((request) => request.command === 'checkoutBranch')).toBe(false)
  })

  it('does not guess a remote when the branch has no upstream', async () => {
    const done = pullLocalBranch('local-only')
    await flush()
    const plan = requestFor('getBranchPullPlan')
    respond(plan.id, standardPlan({ upstream: null, ahead: 0, behind: 0 }))
    await flush()

    expect(document.querySelector('.dialog-error-message')!.textContent).toContain(
      'Branch local-only has no upstream branch.',
    )
    expect(sent.some((request) => request.command === 'pullBranchWithoutCheckout')).toBe(false)
    button('Dismiss').click()
    await done
  })

  it('blocks ahead and diverged branches before mutation', async () => {
    const done = pullLocalBranch('feat/search')
    await flush()
    const plan = requestFor('getBranchPullPlan')
    respond(plan.id, standardPlan({ ahead: 2, behind: 3 }))
    await flush()

    expect(document.querySelector('.dialog-title')!.textContent).toContain(
      'Fast-forward Pull Blocked',
    )
    expect(document.querySelector('.dialog-error-message')!.textContent).toContain(
      '2 commit(s) ahead and 3 commit(s) behind',
    )
    expect(sent.some((request) => request.command === 'pullBranchWithoutCheckout')).toBe(false)
    button('Dismiss').click()
    await done
  })

  it('blocks a branch checked out in another worktree', async () => {
    const done = pullLocalBranch('feat/search')
    await flush()
    const plan = requestFor('getBranchPullPlan')
    respond(plan.id, standardPlan({ worktreePath: '/tmp/feature-worktree' }))
    await flush()

    expect(document.querySelector('.dialog-error-message')!.textContent).toContain(
      'checked out in worktree /tmp/feature-worktree',
    )
    expect(sent.some((request) => request.command === 'pullBranchWithoutCheckout')).toBe(false)
    button('Dismiss').click()
    await done
  })

  it('shows Git stderr and refreshes after an execution-time rejection', async () => {
    const done = pullLocalBranch('feat/search')
    await flush()
    const plan = requestFor('getBranchPullPlan')
    respond(plan.id, standardPlan())
    await flush()
    button('Pull Branch').click()
    await flush()

    const pull = requestFor('pullBranchWithoutCheckout')
    respond(pull.id, { ok: false, error: 'fatal: refusing to fetch into checked out branch' })
    await flush()
    await flush()

    expect(sent.some((request) => request.command === 'getGraph')).toBe(true)
    expect(document.querySelector('.dialog-error-message')!.textContent).toContain(
      'fatal: refusing to fetch into checked out branch',
    )
    button('Dismiss').click()
    await done
  })
})
