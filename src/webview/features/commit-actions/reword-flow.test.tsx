// @vitest-environment jsdom
import { render } from 'solid-js/web'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { vi } from 'vitest'
import type { Commit } from '@shared-types/domain'
import type { BridgeRequest } from '@shared-types/messages'

/**
 * reword 흐름 회귀 테스트:
 * 다이얼로그 열림 → textarea에 기존 메시지 프리필 → 편집 → 확인 →
 * host로 rewordCommit 요청 → 성공 시 그래프 재조회.
 */

const sent: BridgeRequest[] = []

const ORIGINAL_MESSAGE = 'feat: 기존 커밋 메시지\n\n본문 설명 줄'

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

// bridge/graphStore 모듈 로드 전에 webview 전역을 준비한다
vi.stubGlobal('acquireVsCodeApi', () => ({
  postMessage: (message: BridgeRequest) => {
    sent.push(message)
    if (message.command === 'getGraph') {
      setTimeout(() => respond(message.id, EMPTY_GRAPH), 0)
    }
    if (message.command === 'getCommitDetails') {
      setTimeout(() => respond(message.id, { body: ORIGINAL_MESSAGE }), 0)
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
const { rewordCommit } = await import('./index')
const { graphStore } = await import('../../entities/graph')

function flush(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0))
}

function fakeCommit(hash: string): Commit {
  return {
    hash,
    parents: ['parenthash7654321'],
    author: 'tester',
    authorEmail: 'tester@example.com',
    authorDate: 0,
    commitDate: 0,
    subject: 'feat: 기존 커밋 메시지',
  }
}

describe('reword 흐름', () => {
  let dispose: () => void

  beforeEach(() => {
    sent.length = 0
    document.body.innerHTML = '<div id="root"></div>'
    dispose = render(() => <PromptHost />, document.getElementById('root')!)
  })

  afterEach(() => dispose())

  it('textarea에 기존 메시지가 채워지고, 수정하면 rewordCommit 요청 후 그래프 재조회', async () => {
    await graphStore.switchRepo('/fake/repo')
    sent.length = 0

    const done = rewordCommit(fakeCommit('abcdef1234567890'))
    await flush()
    await flush() // getCommitDetails 응답 대기

    const textarea = document.querySelector<HTMLTextAreaElement>('.dialog-field textarea')
    expect(textarea, '다이얼로그의 textarea가 열려야 한다').toBeTruthy()
    expect(textarea!.value, '기존 커밋 메시지가 프리필된다').toBe(ORIGINAL_MESSAGE)

    // HEAD가 아닌 커밋(headHash: null) — rebase 경고 표시
    expect(document.querySelector('.dialog-warning'), '비-HEAD 커밋 경고 표시').toBeTruthy()

    textarea!.value = 'feat: 수정된 커밋 메시지'
    textarea!.dispatchEvent(new Event('input', { bubbles: true }))
    await flush()

    const confirmBtn = [...document.querySelectorAll<HTMLButtonElement>('.dialog-footer button')]
      .find((b) => b.textContent === 'Save')!
    confirmBtn.click()
    await flush()

    const rewordReq = sent.find((m) => m.command === 'rewordCommit')
    expect(rewordReq, 'rewordCommit 요청 전송').toBeTruthy()
    expect(rewordReq!.params).toEqual({
      repo: '/fake/repo',
      hash: 'abcdef1234567890',
      message: 'feat: 수정된 커밋 메시지',
    })

    respond(rewordReq!.id, { ok: true })
    await flush()
    await flush()
    expect(sent.some((m) => m.command === 'getGraph'), '성공 후 그래프 재조회').toBe(true)
    await done
  })

  it('메시지를 바꾸지 않고 확인하면 요청을 보내지 않는다', async () => {
    await graphStore.switchRepo('/fake/repo')
    sent.length = 0

    const done = rewordCommit(fakeCommit('abcdef1234567890'))
    await flush()
    await flush()

    const confirmBtn = [...document.querySelectorAll<HTMLButtonElement>('.dialog-footer button')]
      .find((b) => b.textContent === 'Save')!
    confirmBtn.click()
    await done

    expect(sent.some((m) => m.command === 'rewordCommit')).toBe(false)
  })

  it('빈 메시지는 실행하지 않고 에러를 안내한다', async () => {
    await graphStore.switchRepo('/fake/repo')
    sent.length = 0

    const done = rewordCommit(fakeCommit('abcdef1234567890'))
    await flush()
    await flush()

    const textarea = document.querySelector<HTMLTextAreaElement>('.dialog-field textarea')!
    textarea.value = '   '
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    await flush()

    const confirmBtn = [...document.querySelectorAll<HTMLButtonElement>('.dialog-footer button')]
      .find((b) => b.textContent === 'Save')!
    confirmBtn.click()
    await done

    expect(sent.some((m) => m.command === 'rewordCommit')).toBe(false)
    expect(graphStore.error()).toContain('empty')
    graphStore.setError(null)
  })
})
