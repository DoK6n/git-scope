// @vitest-environment jsdom
import { createRoot, createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { registerEscapeLayer, useEscapeLayer } from './escapeStack'

function pressEscape(init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true, ...init })
  ;(document.activeElement ?? document.body).dispatchEvent(event)
  return event
}

describe('escape stack', () => {
  const cleanups: (() => void)[] = []
  const register = (...args: Parameters<typeof registerEscapeLayer>) => {
    const off = registerEscapeLayer(...args)
    cleanups.push(off)
    return off
  }

  afterEach(() => {
    cleanups.splice(0).forEach((off) => off())
    document.body.innerHTML = ''
  })

  it('closes only the highest priority layer per press', () => {
    const closed: string[] = []
    register('details', () => closed.push('details'))
    register('panel', () => closed.push('panel'))
    register('menu', () => closed.push('menu'))
    register('dialog', () => closed.push('dialog'))
    register('popover', () => closed.push('popover'))

    for (let i = 0; i < 6; i++) pressEscape()

    expect(closed).toEqual(['menu', 'dialog', 'popover', 'panel', 'details'])
  })

  it('closes the most recently opened panel first', () => {
    const closed: string[] = []
    register('panel', () => closed.push('worktrees'))
    register('panel', () => closed.push('stashes'))

    pressEscape()
    expect(closed).toEqual(['stashes'])
  })

  it('stops other Escape listeners when a layer handles the key', () => {
    const other = vi.fn()
    window.addEventListener('keydown', other)
    register('panel', () => undefined)

    const event = pressEscape()
    window.removeEventListener('keydown', other)

    expect(event.defaultPrevented).toBe(true)
    expect(other).not.toHaveBeenCalled()
  })

  it('leaves Escape alone when nothing is registered', () => {
    const other = vi.fn()
    window.addEventListener('keydown', other)

    const event = pressEscape()
    window.removeEventListener('keydown', other)

    expect(event.defaultPrevented).toBe(false)
    expect(other).toHaveBeenCalledOnce()
  })

  it('ignores Escape while an IME composition is active', () => {
    const close = vi.fn()
    register('panel', close)

    pressEscape({ isComposing: true })
    expect(close).not.toHaveBeenCalled()
  })

  it('restores focus to the element focused when the layer opened', () => {
    document.body.innerHTML = '<button id="opener">Open</button><input id="inside" />'
    const opener = document.getElementById('opener') as HTMLButtonElement
    opener.focus()
    register('panel', () => undefined)
    ;(document.getElementById('inside') as HTMLInputElement).focus()

    pressEscape()
    expect(document.activeElement).toBe(opener)
  })

  it('falls back to the graph area when the previous element is gone', () => {
    document.body.innerHTML =
      '<div id="graph" tabindex="-1" data-escape-fallback></div><button id="opener">Open</button>'
    ;(document.getElementById('opener') as HTMLButtonElement).focus()
    register('menu', () => undefined)
    document.getElementById('opener')!.remove()

    pressEscape()
    expect(document.activeElement).toBe(document.getElementById('graph'))
  })

  it('registers only while the open accessor is true', () => {
    const close = vi.fn()
    const [open, setOpen] = createSignal(false)
    const dispose = createRoot((dispose) => {
      useEscapeLayer('panel', open, () => {
        close()
        setOpen(false)
      })
      return dispose
    })

    pressEscape()
    expect(close).not.toHaveBeenCalled()

    setOpen(true)
    pressEscape()
    expect(close).toHaveBeenCalledOnce()

    pressEscape()
    expect(close).toHaveBeenCalledOnce()
    dispose()
  })
})
