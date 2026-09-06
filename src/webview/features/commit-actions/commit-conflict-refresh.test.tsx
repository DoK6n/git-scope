// @vitest-environment jsdom
import { render } from 'solid-js/web'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Commit } from '@shared-types/domain'
import type { BridgeRequest, RequestCommand } from '@shared-types/messages'

const sent: BridgeRequest[] = []
const graph = {
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

function respond(id: number, result: unknown): void {
  window.dispatchEvent(
    new MessageEvent('message', { data: { kind: 'response', id, ok: true, result } }),
  )
}

vi.stubGlobal('acquireVsCodeApi', () => ({
  postMessage: (message: BridgeRequest) => {
    sent.push(message)
    if (message.command === 'getGraph') setTimeout(() => respond(message.id, graph), 0)
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
const { PromptHost } = await import('../../shared/ui')
const { cherryPick, rebaseOnto, revertCommit } = await import('./index')

const commit: Commit = {
  hash: 'abcdef1234567890',
  parents: ['parent'],
  author: 'Test',
  authorEmail: 'test@example.com',
  authorDate: 0,
  commitDate: 0,
  subject: 'conflicting change',
}
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

describe('commit action conflict refresh', () => {
  let dispose: () => void

  beforeEach(async () => {
    sent.length = 0
    document.body.innerHTML = '<div id="root"></div>'
    dispose = render(() => <PromptHost />, document.getElementById('root')!)
    await graphStore.switchRepo('/fake/repo')
    sent.length = 0
  })

  afterEach(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    dispose()
    graphStore.setError(null)
  })

  it.each([
    ['cherryPick', 'Cherry Pick', () => cherryPick(commit)],
    ['revert', 'Revert', () => revertCommit(commit)],
    ['rebase', 'Rebase', () => rebaseOnto('develop', 'develop')],
  ] as const)(
    '%s 충돌 실패 뒤 그래프를 다시 조회한다',
    async (command: RequestCommand, confirmLabel: string, invoke: () => Promise<void>) => {
      const done = invoke()
      await flush()
      const confirm = [...document.querySelectorAll<HTMLButtonElement>('.dialog-footer button')]
        .find((button) => button.textContent === confirmLabel)!
      confirm.click()
      await flush()

      const action = sent.find((message) => message.command === command)!
      respond(action.id, { ok: false, error: `CONFLICT: ${command}` })
      await done
      await flush()

      const actionIndex = sent.indexOf(action)
      expect(sent.slice(actionIndex + 1).some((message) => message.command === 'getGraph')).toBe(
        true,
      )
    },
  )
})
