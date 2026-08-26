// @vitest-environment jsdom
import { render } from 'solid-js/web'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BridgeRequest } from '@shared-types/messages'

const graph = {
  commits: [
    {
      hash: '1111111',
      parents: [],
      author: 'A',
      authorEmail: 'a@example.com',
      authorDate: 1,
      commitDate: 1,
      subject: 'fix first bug',
    },
    {
      hash: '2222222',
      parents: ['1111111'],
      author: 'B',
      authorEmail: 'b@example.com',
      authorDate: 2,
      commitDate: 2,
      subject: 'feature work',
    },
    {
      hash: '3333333',
      parents: ['2222222'],
      author: 'C',
      authorEmail: 'c@example.com',
      authorDate: 3,
      commitDate: 3,
      subject: 'fix second bug',
    },
  ],
  refs: [],
  headHash: '3333333',
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
;(window as unknown as { __GITSCOPE_SETTINGS__: unknown }).__GITSCOPE_SETTINGS__ = {
  initialLoadCommits: 300,
  loadMoreCommits: 100,
  dateType: 'author',
  fetchPruneByDefault: false,
  language: 'en',
}

const { SearchWidget, searchStore } = await import('../index')
const { graphStore } = await import('../../../entities/graph')

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe('SearchWidget', () => {
  let dispose: () => void

  beforeEach(async () => {
    document.body.innerHTML = '<div id="root"></div>'
    searchStore.search('')
    dispose = render(() => <SearchWidget />, document.getElementById('root')!)
    await graphStore.switchRepo('/fake/repo')
  })

  afterEach(() => dispose())

  it('Cmd+F로 열고 결과 위치·No results를 표시하며 Escape로 닫는다', async () => {
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'f',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      }),
    )
    await flush()

    const input = document.querySelector<HTMLInputElement>('.find-widget-input')!
    expect(input).toBeTruthy()
    expect(document.activeElement).toBe(input)
    expect(input.placeholder).toBe('Find (↑↓ for history)')
    expect(document.querySelector('.find-widget-status')?.textContent?.trim()).toBe('No results')

    input.blur()
    expect(input.placeholder).toBe('Find')
    input.focus()

    input.value = 'Fix'
    input.dispatchEvent(new InputEvent('input', { bubbles: true }))
    expect(document.querySelector('.find-widget-status')?.textContent?.trim()).toBe('1 of 2')

    const modifiers = document.querySelectorAll<HTMLButtonElement>('.find-modifier')
    modifiers[0]!.click()
    expect(document.querySelector('.find-widget-status')?.textContent?.trim()).toBe('No results')
    modifiers[0]!.click()

    input.value = 'fix'
    input.dispatchEvent(new InputEvent('input', { bubbles: true }))
    expect(document.querySelector('.find-widget-status')?.textContent?.trim()).toBe('1 of 2')

    const actions = document.querySelectorAll<HTMLButtonElement>('.find-widget-action')
    actions[1]!.click()
    expect(document.querySelector('.find-widget-status')?.textContent?.trim()).toBe('2 of 2')

    input.value = 'missing'
    input.dispatchEvent(new InputEvent('input', { bubbles: true }))
    expect(document.querySelector('.find-widget-status')?.textContent?.trim()).toBe('No results')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(document.querySelector('.find-widget')?.classList.contains('open')).toBe(false)
    expect(input.disabled).toBe(true)
    expect(searchStore.query()).toBe('')
  })
})
