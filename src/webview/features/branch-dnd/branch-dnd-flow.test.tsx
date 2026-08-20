// @vitest-environment jsdom
import { render } from 'solid-js/web'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BridgeRequest } from '@shared-types/messages'

/**
 * 브랜치 드래그앤드롭 흐름 회귀 테스트:
 * 드롭 → merge/rebase 선택 다이얼로그 → 선택에 따라 host 요청 → 성공 시 그래프 재조회.
 */

const sent: BridgeRequest[] = []

function respond(id: number, result: unknown) {
  window.dispatchEvent(
    new MessageEvent('message', {
      data: { kind: 'response', id, ok: true, result },
    }),
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
const { confirmBranchDrop } = await import('./index')
const { graphStore } = await import('../../entities/graph')

function flush(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0))
}

function radioLabels(): string[] {
  return [...document.querySelectorAll<HTMLInputElement>('input[type=radio]')].map(
    (radio) => radio.closest('label')?.textContent ?? '',
  )
}

function clickConfirm(label: string): void {
  const confirmBtn = [...document.querySelectorAll<HTMLButtonElement>('.dialog-footer button')]
    .find((b) => b.textContent === label)!
  confirmBtn.click()
}

describe('브랜치 드래그앤드롭 흐름', () => {
  let dispose: () => void

  beforeEach(async () => {
    sent.length = 0
    document.body.innerHTML = '<div id="root"></div>'
    dispose = render(() => <PromptHost />, document.getElementById('root')!)
    await graphStore.switchRepo('/fake/repo')
    sent.length = 0
  })

  afterEach(() => dispose())

  it('로컬 브랜치 드롭: merge/rebase 선택지 표시, rebase 선택 시 경고 + rebaseBranchOnto 요청', async () => {
    const done = confirmBranchDrop({ name: 'feature/login', isRemote: false }, 'develop')
    await flush()

    const labels = radioLabels()
    expect(labels.some((l) => l.includes('Merge feature/login into develop'))).toBe(true)
    expect(labels.some((l) => l.includes('Rebase feature/login onto develop'))).toBe(true)

    // 기본값 merge — 경고 없음
    expect(document.querySelector('.dialog-warning')).toBeNull()

    const radios = [...document.querySelectorAll<HTMLInputElement>('input[type=radio]')]
    radios[1]!.click() // rebase
    await flush()
    expect(document.querySelector('.dialog-warning'), 'rebase 경고 표시').toBeTruthy()

    clickConfirm('Run')
    await flush()

    const req = sent.find((m) => m.command === 'rebaseBranchOnto')
    expect(req, 'rebaseBranchOnto 요청 전송').toBeTruthy()
    expect(req!.params).toEqual({ repo: '/fake/repo', branch: 'feature/login', onto: 'develop' })

    respond(req!.id, { ok: true })
    await flush()
    await flush()
    expect(sent.some((m) => m.command === 'getGraph'), '성공 후 그래프 재조회').toBe(true)
    await done
  })

  it('merge 선택 시 mergeBranchInto 요청', async () => {
    const done = confirmBranchDrop({ name: 'feature/login', isRemote: false }, 'develop')
    await flush()

    clickConfirm('Run') // 기본값 merge
    await flush()

    const req = sent.find((m) => m.command === 'mergeBranchInto')
    expect(req).toBeTruthy()
    expect(req!.params).toEqual({ repo: '/fake/repo', source: 'feature/login', target: 'develop' })
    respond(req!.id, { ok: true })
    await done
  })

  it('원격 브랜치 드롭에는 rebase 선택지가 없다', async () => {
    const done = confirmBranchDrop({ name: 'origin/main', isRemote: true }, 'develop')
    await flush()

    const labels = radioLabels()
    expect(labels).toHaveLength(1)
    expect(labels[0]).toContain('Merge origin/main into develop')

    clickConfirm('Run')
    await flush()
    const req = sent.find((m) => m.command === 'mergeBranchInto')
    expect(req!.params).toEqual({ repo: '/fake/repo', source: 'origin/main', target: 'develop' })
    respond(req!.id, { ok: true })
    await done
  })
})
