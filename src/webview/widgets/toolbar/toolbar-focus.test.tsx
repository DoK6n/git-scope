// @vitest-environment jsdom
import { render } from 'solid-js/web'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.stubGlobal('acquireVsCodeApi', () => ({ postMessage: () => undefined }))
;(window as unknown as { __GITSCOPE_SETTINGS__: unknown }).__GITSCOPE_SETTINGS__ = {
  initialLoadCommits: 300,
  loadMoreCommits: 100,
  dateType: 'author',
  fetchPruneByDefault: false,
  language: 'en',
}

const { Toolbar } = await import('./index')

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe('branch filter focus', () => {
  let dispose: () => void

  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>'
    dispose = render(() => <Toolbar />, document.getElementById('root')!)
  })

  afterEach(() => dispose())

  it('focuses the glob input when the non-modal dropdown opens', async () => {
    document.querySelector<HTMLButtonElement>('.branch-select')!.click()
    await flush()

    const input = document.querySelector<HTMLInputElement>('.branch-filter-glob input')!
    expect(document.activeElement).toBe(input)

    input.value = 'feature/*'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    document.querySelector<HTMLButtonElement>('.branch-select')!.click()
    await flush()

    const reopened = document.querySelector<HTMLInputElement>('.branch-filter-glob input')!
    expect(document.activeElement).toBe(reopened)
    expect(reopened.selectionStart).toBe(0)
    expect(reopened.selectionEnd).toBe(reopened.value.length)
  })
})
