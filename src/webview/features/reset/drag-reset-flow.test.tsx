// @vitest-environment jsdom
import { render } from 'solid-js/web'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Commit } from '@shared-types/domain'
import type { BridgeRequest } from '@shared-types/messages'

/**
 * drag-to-reset 흐름 회귀 테스트 (스펙 60-new-features §10):
 * plan 설정 → 확인 다이얼로그(지워질 커밋 리스트 + 새 HEAD) → 확인 →
 * target으로 reset 요청 → 닫히면 미리보기(plan)가 지워진다.
 */

const sent: BridgeRequest[] = []

function respond(id: number, result: unknown) {
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
    if (message.command === 'getGraph') {
      setTimeout(() => respond(message.id, EMPTY_GRAPH), 0)
    }
  },
}))
;(window as unknown as { __GITSCOPE_SETTINGS__: unknown }).__GITSCOPE_SETTINGS__ = {
  initialLoadCommits: 300,
  loadMoreCommits: 100,
  dateType: 'author',
  fetchPruneByDefault: false,
}

const { PromptHost } = await import('../../shared/ui')
const { confirmDragReset, dragResetStore } = await import('./index')
const { graphStore } = await import('../../entities/graph')

function flush(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0))
}

function commit(hash: string, parents: string[], subject: string): Commit {
  return {
    hash,
    parents,
    author: 'a',
    authorEmail: 'a@x',
    authorDate: 0,
    commitDate: 0,
    subject,
  }
}

describe('drag-to-reset 흐름', () => {
  let dispose: () => void

  beforeEach(() => {
    sent.length = 0
    dragResetStore.clear()
    document.body.innerHTML = '<div id="root"></div>'
    dispose = render(() => <PromptHost />, document.getElementById('root')!)
  })

  afterEach(() => dispose())

  it('다이얼로그에 지워질 커밋 리스트와 새 HEAD가 표시되고, 확인 시 target으로 reset한다', async () => {
    await graphStore.switchRepo('/fake/repo')
    sent.length = 0

    dragResetStore.setPlan({
      erased: [
        commit('aaaa111122223333', ['bbbb111122223333'], 'feat: one'),
        commit('bbbb111122223333', ['cccc111122223333'], 'feat: two'),
      ],
      target: commit('cccc111122223333', ['dddd111122223333'], 'base commit'),
      dimmed: new Set(['aaaa111122223333', 'bbbb111122223333']),
    })
    const done = confirmDragReset()
    await flush()

    const dialog = document.querySelector('.dialog')
    expect(dialog, '다이얼로그가 열려야 한다').toBeTruthy()

    // 지워질 커밋 리스트
    const items = [...document.querySelectorAll('.dialog-list-item')]
    expect(items.length).toBe(2)
    expect(items[0]!.textContent).toContain('aaaa1111')
    expect(items[0]!.textContent).toContain('feat: one')
    // 새 HEAD 안내 footer
    expect(document.querySelector('.dialog-list-footer')!.textContent).toContain('cccc1111')

    const confirmBtn = [...document.querySelectorAll<HTMLButtonElement>('.dialog-footer button')]
      .find((b) => b.textContent === 'Reset')!
    confirmBtn.click()
    await flush()

    const resetReq = sent.find((m) => m.command === 'reset')
    expect(resetReq, 'reset 요청 전송').toBeTruthy()
    // erased가 아니라 새 HEAD(target)로 reset해야 한다
    expect(resetReq!.params).toEqual({
      repo: '/fake/repo',
      to: 'cccc111122223333',
      mode: 'mixed',
    })
    respond(resetReq!.id, { ok: true })
    await done
    // 다이얼로그가 닫히면 미리보기도 지워진다
    expect(dragResetStore.plan()).toBeNull()
  })

  it('취소하면 reset 없이 미리보기만 지워진다', async () => {
    await graphStore.switchRepo('/fake/repo')
    sent.length = 0

    dragResetStore.setPlan({
      erased: [commit('aaaa111122223333', ['cccc111122223333'], 'feat: one')],
      target: commit('cccc111122223333', [], 'base commit'),
      dimmed: new Set(['aaaa111122223333']),
    })
    const done = confirmDragReset()
    await flush()

    const cancelBtn = [...document.querySelectorAll<HTMLButtonElement>('.dialog-footer button')]
      .find((b) => b.textContent === 'Cancel')!
    cancelBtn.click()
    await done

    expect(sent.some((m) => m.command === 'reset')).toBe(false)
    expect(dragResetStore.plan()).toBeNull()
  })

  it('머지 커밋에는 merge 표식, 10개 초과는 "… and N more"로 접힌다', async () => {
    await graphStore.switchRepo('/fake/repo')

    const erased = Array.from({ length: 12 }, (_, i) =>
      commit(
        `${String(i).padStart(4, '0')}111122223333`,
        i === 0 ? ['p1', 'p2'] : ['p1'],
        `commit ${i}`,
      ),
    )
    dragResetStore.setPlan({
      erased,
      target: commit('cccc111122223333', [], 'base commit'),
      dimmed: new Set(erased.map((c) => c.hash)),
    })
    const done = confirmDragReset()
    await flush()

    expect(document.querySelectorAll('.dialog-list-item').length).toBe(10)
    expect(document.querySelector('.dialog-list-mark')!.textContent).toBe('merge')
    expect(document.querySelector('.dialog-list-more')!.textContent).toContain('2')

    const cancelBtn = [...document.querySelectorAll<HTMLButtonElement>('.dialog-footer button')]
      .find((b) => b.textContent === 'Cancel')!
    cancelBtn.click()
    await done
  })
})
