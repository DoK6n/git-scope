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

const { GitIcon } = await import('./icons/GitIcon')
const { ContextMenuHost, closeContextMenu, openContextMenu } = await import('./ContextMenu')

const disposers: (() => void)[] = []

afterEach(() => {
  closeContextMenu()
  while (disposers.length > 0) disposers.pop()!()
  document.body.innerHTML = ''
})

function mount(view: () => unknown): HTMLElement {
  const root = document.createElement('div')
  document.body.append(root)
  disposers.push(render(view as never, root))
  return root
}

describe('GitIcon', () => {
  it('uses currentColor so VS Code theme foreground variables control contrast', () => {
    const root = mount(() => <GitIcon name="branch" />)
    const svg = root.querySelector('svg')!
    expect(svg.getAttribute('data-icon')).toBe('branch')
    expect(svg.getAttribute('stroke')).toBe('currentColor')
    expect(svg.innerHTML).not.toMatch(/#[0-9a-f]{3,8}/i)
  })
})

describe('roadmap icon locations', () => {
  it('keeps context menus text-only while preserving destructive styling', () => {
    const root = mount(() => <ContextMenuHost />)
    openContextMenu(new MouseEvent('contextmenu', { clientX: 10, clientY: 10 }), [
      { label: 'Copy', intent: 'read', onClick: () => {} },
      { label: 'Checkout', intent: 'change', onClick: () => {} },
      { label: 'Delete', intent: 'change', danger: true, onClick: () => {} },
    ])

    expect(root.querySelectorAll('[data-icon]')).toHaveLength(0)
    expect(root.querySelectorAll('.context-menu-icon')).toHaveLength(0)
    expect(root.querySelectorAll('.context-menu-item')).toHaveLength(3)
    expect(root.querySelector('.context-menu-item.danger')!.textContent).toContain('Delete')
  })

})
