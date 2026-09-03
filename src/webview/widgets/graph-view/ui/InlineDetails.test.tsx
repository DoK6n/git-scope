// @vitest-environment jsdom
import { render } from 'solid-js/web'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BridgeRequest } from '@shared-types/messages'

const graph = {
  commits: [
    {
      hash: 'commit-1',
      parents: ['parent-1'],
      author: 'Author',
      authorEmail: 'author@example.com',
      authorDate: 1,
      commitDate: 1,
      subject: 'feat: line stats',
    },
  ],
  refs: [],
  headHash: 'commit-1',
  headBranch: 'main',
  uncommittedCount: 0,
  moreAvailable: false,
  worktreeBranches: [],
}

const details = {
  hash: 'commit-1',
  parents: ['parent-1'],
  author: 'Author',
  authorEmail: 'author@example.com',
  authorDate: 1,
  committer: 'Committer',
  commitDate: 1,
  body: 'feat: line stats',
  files: [],
}

let pendingStats: BridgeRequest<'getCommitLineStats'> | null = null

function respond(id: number, result: unknown): void {
  window.dispatchEvent(
    new MessageEvent('message', { data: { kind: 'response', id, ok: true, result } }),
  )
}

function reject(id: number, error: string): void {
  window.dispatchEvent(
    new MessageEvent('message', { data: { kind: 'response', id, ok: false, error } }),
  )
}

vi.stubGlobal('acquireVsCodeApi', () => ({
  postMessage: (message: BridgeRequest) => {
    if (message.command === 'getGraph') setTimeout(() => respond(message.id, graph), 0)
    if (message.command === 'getCommitDetails') setTimeout(() => respond(message.id, details), 0)
    if (message.command === 'getCommitLineStats') {
      pendingStats = message as BridgeRequest<'getCommitLineStats'>
    }
    if (message.command === 'getFileIcons') {
      setTimeout(
        () =>
          respond(message.id, {
            files: {},
            foldersCollapsed: {},
            foldersExpanded: {},
            fonts: [],
          }),
        0,
      )
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

const { graphStore } = await import('../../../entities/graph')
const { setLocale } = await import('../../../shared/lib')
const { InlineDetails } = await import('./InlineDetails')

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe('InlineDetails line stats', () => {
  let dispose: () => void

  beforeEach(async () => {
    document.body.innerHTML = '<div id="root"></div>'
    pendingStats = null
    await graphStore.switchRepo('/fake/repo')
    graphStore.setSelectedCommit('commit-1')
    dispose = render(
      () => <InlineDetails top={0} left={0} />,
      document.getElementById('root')!,
    )
    await flush()
    await flush()
  })

  afterEach(() => {
    setLocale('en')
    graphStore.setSelectedCommit(null)
    dispose()
  })

  it('상세 본문을 먼저 보여주고 통계 응답 후 실질·raw 수치를 표시한다', async () => {
    expect(document.querySelector('.details-subject')?.textContent).toBe('feat: line stats')
    expect(document.querySelector('.details-line-stats')?.textContent).toContain('Calculating lines…')
    expect(pendingStats?.params).toEqual({
      repo: '/fake/repo',
      hash: 'commit-1',
      baseHash: 'parent-1',
    })

    respond(pendingStats!.id, {
      additions: 3,
      deletions: 2,
      rawAdditions: 7,
      rawDeletions: 5,
      fallbackFiles: 1,
      binaryFiles: 1,
    })
    await flush()

    const stats = document.querySelector<HTMLElement>('.details-line-stats')!
    expect(stats.textContent?.replace(/\s/g, '')).toBe('+3/−2')
    expect(stats.dataset.tip).toBe(
      'Raw numstat: +7 / −5 · 1 unsupported file(s) use raw counts · 1 binary file(s) excluded',
    )
  })

  it('통계 실패가 상세 본문을 가리지 않는다', async () => {
    setLocale('ko')
    reject(pendingStats!.id, 'diff failed')
    await flush()

    expect(document.querySelector('.details-subject')?.textContent).toBe('feat: line stats')
    expect(document.querySelector('.details-line-stats')?.textContent).toContain(
      '라인 수를 계산할 수 없음',
    )
  })

  it('한국어 설정에서 로딩 문구와 raw 툴팁을 번역한다', async () => {
    setLocale('ko')
    expect(document.querySelector('.details-line-stats')?.textContent).toContain(
      '라인 수 계산 중…',
    )

    respond(pendingStats!.id, {
      additions: 3,
      deletions: 2,
      rawAdditions: 7,
      rawDeletions: 5,
      fallbackFiles: 1,
      binaryFiles: 1,
    })
    await flush()

    expect(document.querySelector<HTMLElement>('.details-line-stats')?.dataset.tip).toBe(
      '원시 numstat: +7 / −5 · 미지원 파일 1개는 원시 수치 사용 · 바이너리 파일 1개는 합계에서 제외',
    )
  })
})
