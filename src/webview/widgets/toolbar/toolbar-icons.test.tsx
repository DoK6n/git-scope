// @vitest-environment jsdom
import { render } from 'solid-js/web'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BridgeRequest } from '@shared-types/messages'

vi.stubGlobal('acquireVsCodeApi', () => ({ postMessage: (_message: BridgeRequest) => {} }))
;(window as unknown as { __GITSCOPE_SETTINGS__: unknown }).__GITSCOPE_SETTINGS__ = {
  initialLoadCommits: 300,
  loadMoreCommits: 100,
  dateType: 'author',
  fetchPruneByDefault: false,
  language: 'en',
}

const { Toolbar } = await import('./index')

let dispose: (() => void) | undefined
afterEach(() => {
  dispose?.()
  document.body.innerHTML = ''
})

describe('Git toolbar icons', () => {
  it('renders a consistent icon on every Git-related toolbar control', () => {
    const root = document.createElement('div')
    document.body.append(root)
    dispose = render(() => <Toolbar />, root)
    const icons = [...root.querySelectorAll('.toolbar-right [data-icon]')].map((icon) =>
      icon.getAttribute('data-icon'),
    )
    expect(icons).toEqual([
      'statistics',
      'reset',
      'stash',
      'worktree',
      'fetch',
      'prune',
      'refresh',
    ])
  })
})
