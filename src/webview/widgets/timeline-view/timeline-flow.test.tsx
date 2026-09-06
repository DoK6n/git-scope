// @vitest-environment jsdom
import { Show } from 'solid-js'
import { render } from 'solid-js/web'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BridgeRequest } from '@shared-types/messages'

function timestamp(year: number, month: number, day: number): number {
  return new Date(year, month - 1, day, 12).getTime() / 1000
}

const graph = {
  commits: [
    {
      hash: 'feb-bob',
      parents: ['jan-ada'],
      author: 'Bob',
      authorEmail: 'bob@example.com',
      authorDate: timestamp(2026, 2, 10),
      commitDate: timestamp(2026, 2, 10),
      subject: 'February work',
    },
    {
      hash: 'jan-ada',
      parents: [],
      author: 'Ada',
      authorEmail: 'ada@example.com',
      authorDate: timestamp(2026, 1, 10),
      commitDate: timestamp(2026, 1, 10),
      subject: 'January work',
    },
  ],
  refs: [{ name: 'main', hash: 'feb-bob', type: 'head' }],
  headHash: 'feb-bob',
  headBranch: 'main',
  uncommittedCount: 0,
  moreAvailable: false,
  worktreeBranches: [],
}

function respond(id: number, result: unknown) {
  window.dispatchEvent(
    new MessageEvent('message', { data: { kind: 'response', id, ok: true, result } }),
  )
}

vi.stubGlobal('acquireVsCodeApi', () => ({
  postMessage: (message: BridgeRequest) => {
    if (message.command === 'getGraph') setTimeout(() => respond(message.id, graph), 0)
  },
}))
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    disconnect() {}
  },
)
;(window as unknown as { __GITSCOPE_SETTINGS__: unknown }).__GITSCOPE_SETTINGS__ = {
  initialLoadCommits: 300,
  loadMoreCommits: 100,
  dateType: 'author',
  fetchPruneByDefault: false,
  language: 'en',
}

const { TimelineView } = await import('./ui/TimelineView')
const { GraphView } = await import('../graph-view')
const { Toolbar } = await import('../toolbar')
const { App } = await import('../../app/App')
const { timelineStore } = await import('../../features/timeline')
const { graphStore } = await import('../../entities/graph')
const { setLocale } = await import('../../shared/lib')

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe('timeline to graph flow', () => {
  let dispose: (() => void) | undefined

  beforeEach(async () => {
    document.body.innerHTML = '<div id="root"></div>'
    timelineStore.clearDateFilter()
    timelineStore.setSelectedAuthor(null)
    timelineStore.setUnit('month')
    timelineStore.closePanel()
    setLocale('en')
    graphStore.setSelectedCommit(null)
    await graphStore.switchRepo('/fake/repo')
  })

  afterEach(() => {
    dispose?.()
    dispose = undefined
    timelineStore.clearDateFilter()
    graphStore.setSelectedCommit(null)
    setLocale('en')
  })

  it('toggles a line timeline above the graph from an icon button', () => {
    dispose = render(
      () => (
        <>
          <Toolbar />
          <Show when={timelineStore.panelOpen()}>
            <TimelineView />
          </Show>
          <GraphView />
        </>
      ),
      document.getElementById('root')!,
    )

    const timelineButton = document.querySelector<HTMLButtonElement>(
      '[aria-label="Toggle commit timeline"]',
    )!
    timelineButton.click()

    expect(timelineStore.panelOpen()).toBe(true)
    expect(document.querySelector('.timeline-panel + .graph-view')).toBeTruthy()
    expect(document.querySelector('.timeline-line')).toBeTruthy()
    expect(document.querySelector('.timeline-bar')).toBeNull()

    const january = [...document.querySelectorAll<SVGGElement>('.timeline-bucket')].find(
      (bucket) => bucket.getAttribute('aria-label')?.startsWith('2026-01:'),
    )!
    january.dispatchEvent(new MouseEvent('mouseenter'))
    expect(document.querySelector('.timeline-hover-line')).toBeTruthy()
    expect(document.querySelector('.timeline-tooltip')?.textContent).toContain('2026-01')

    timelineButton.click()
    expect(timelineStore.panelOpen()).toBe(false)
    expect(document.querySelector('.timeline-panel')).toBeNull()
  })

  it('translates timeline toolbar and chart labels to Korean', () => {
    setLocale('ko')
    dispose = render(
      () => (
        <>
          <Toolbar />
          <TimelineView />
        </>
      ),
      document.getElementById('root')!,
    )

    expect(document.querySelector('[data-icon="timeline"]')?.parentElement?.getAttribute('aria-label')).toBe(
      '커밋 타임라인 열기/닫기',
    )
    expect(document.querySelector('.timeline-summary strong')?.textContent).toBe('커밋 타임라인')
    expect(document.querySelector<HTMLSelectElement>('.timeline-control-group select')?.options[0]?.text).toBe(
      '모든 작성자',
    )

    dispose()
    timelineStore.selectBucket({
      key: '2026-01',
      start: timestamp(2026, 1, 1),
      end: timestamp(2026, 2, 1),
      total: 1,
      counts: {},
    })
    document.getElementById('root')!.replaceChildren()
    dispose = render(() => <GraphView />, document.getElementById('root')!)
    expect(document.querySelector('.timeline-filter-bar')?.textContent).toContain(
      '타임라인 기간: 2026-01',
    )
    expect(document.querySelector('.timeline-filter-bar button')?.textContent?.trim()).toBe(
      '지우기',
    )
  })

  it('clears repository-specific timeline filters when the repository changes', async () => {
    timelineStore.selectBucket({ key: '2026-01', start: 10, end: 20, total: 1, counts: {} })
    timelineStore.setSelectedAuthor('old-repository-author')
    dispose = render(() => <App />, document.getElementById('root')!)

    await graphStore.switchRepo('/other/repo')

    expect(timelineStore.dateFilter()).toBeNull()
    expect(timelineStore.selectedAuthor()).toBeNull()
  })

  it('filters by author, opens a populated bucket in the graph, and Clear restores all rows', async () => {
    dispose = render(() => <TimelineView />, document.getElementById('root')!)

    const author = document.querySelector<HTMLSelectElement>('[aria-label="Timeline author"]')!
    author.value = [...author.options].find((option) => option.textContent?.startsWith('Ada '))!.value
    author.dispatchEvent(new Event('change', { bubbles: true }))
    expect(document.querySelector('.timeline-scope')?.textContent).toContain('1 of')

    const january = [...document.querySelectorAll<SVGGElement>('.timeline-bucket')].find(
      (bucket) => bucket.getAttribute('aria-label')?.startsWith('2026-01:'),
    )!
    january.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(document.querySelector('.timeline-line')).toBeTruthy()
    expect(timelineStore.dateFilter()?.label).toBe('2026-01')
    expect(graphStore.selectedCommit()).toBe('jan-ada')

    dispose()
    graphStore.setSelectedCommit(null)
    document.getElementById('root')!.replaceChildren()
    dispose = render(() => <GraphView />, document.getElementById('root')!)
    await flush()

    expect(document.querySelectorAll('.commit-row')).toHaveLength(1)
    document.querySelector<HTMLButtonElement>('.timeline-filter-bar button')!.click()
    expect(timelineStore.dateFilter()).toBeNull()
    expect(document.querySelectorAll('.commit-row')).toHaveLength(2)
  })
})
