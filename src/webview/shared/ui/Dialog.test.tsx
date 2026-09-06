// @vitest-environment jsdom
import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Dialog } from './Dialog'
import { confirmDialog, formDialog, PromptHost } from './prompts'

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe('Dialog focus management', () => {
  let dispose: () => void

  beforeEach(() => {
    document.body.innerHTML = '<button id="before">Open</button><div id="root"></div>'
  })

  afterEach(() => dispose?.())

  it('focuses and selects the first prefilled input, then restores the previous focus', async () => {
    const before = document.getElementById('before') as HTMLButtonElement
    before.focus()
    const [open, setOpen] = createSignal(true)

    dispose = render(
      () => (
        <Dialog
          open={open()}
          title="Rename"
          onClose={() => setOpen(false)}
          footer={<button onClick={() => setOpen(false)}>Save</button>}
        >
          <input value="feature/existing" />
          <input value="second" />
        </Dialog>
      ),
      document.getElementById('root')!,
    )

    await flush()
    const first = document.querySelector<HTMLInputElement>('.dialog input')!
    expect(document.activeElement).toBe(first)
    expect(first.selectionStart).toBe(0)
    expect(first.selectionEnd).toBe(first.value.length)

    document.querySelector<HTMLButtonElement>('.dialog-footer button')!.click()
    expect(document.querySelector('.dialog')).toBeNull()
    expect(document.activeElement).toBe(before)
  })

  it('traps forward and backward Tab movement inside the dialog', async () => {
    dispose = render(
      () => (
        <Dialog open title="Edit" onClose={() => undefined} footer={<button>Save</button>}>
          <input />
          <button>Choice</button>
        </Dialog>
      ),
      document.getElementById('root')!,
    )

    await flush()
    const input = document.querySelector<HTMLInputElement>('.dialog input')!
    const buttons = [...document.querySelectorAll<HTMLButtonElement>('.dialog button')]
    const last = buttons.at(-1)!

    last.focus()
    last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    expect(document.activeElement).toBe(input)

    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }),
    )
    expect(document.activeElement).toBe(last)
  })

  it('keeps Enter in a textarea as input and preserves Escape close behavior', async () => {
    let closed = false
    dispose = render(
      () => (
        <Dialog open title="Message" onClose={() => (closed = true)}>
          <textarea value="existing message" />
        </Dialog>
      ),
      document.getElementById('root')!,
    )

    await flush()
    const textarea = document.querySelector<HTMLTextAreaElement>('.dialog textarea')!
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(closed).toBe(false)
    expect(document.querySelector('.dialog')).toBeTruthy()

    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(closed).toBe(true)
  })

  it('submits every form dialog from a single-line input with Enter', async () => {
    dispose = render(() => <PromptHost />, document.getElementById('root')!)
    const result = formDialog({
      title: 'Rename',
      fields: [{ kind: 'text', name: 'name', label: 'Name', initial: 'old name' }],
      confirmLabel: 'Rename',
    })
    await flush()

    const input = document.querySelector<HTMLInputElement>('.dialog input')!
    input.value = 'new name'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))

    await expect(result).resolves.toEqual({ name: 'new name' })
    expect(document.querySelector('.dialog')).toBeNull()
  })

  it('cancels every form dialog with Escape', async () => {
    dispose = render(() => <PromptHost />, document.getElementById('root')!)
    const result = formDialog({
      title: 'Rename',
      fields: [{ kind: 'text', name: 'name', label: 'Name' }],
    })
    await flush()

    document
      .querySelector<HTMLInputElement>('.dialog input')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

    await expect(result).resolves.toBeNull()
    expect(document.querySelector('.dialog')).toBeNull()
  })

  it('focuses the container for a destructive confirmation and never its confirm button', async () => {
    const before = document.getElementById('before') as HTMLButtonElement
    before.focus()
    dispose = render(() => <PromptHost />, document.getElementById('root')!)

    const result = confirmDialog({
      title: 'Drop Stash',
      message: 'This cannot be undone.',
      confirmLabel: 'Drop',
      danger: true,
    })
    await flush()

    const dialog = document.querySelector<HTMLElement>('.dialog')!
    const danger = document.querySelector<HTMLButtonElement>('.dialog-footer .danger')!
    expect(document.activeElement).toBe(dialog)
    expect(document.activeElement).not.toBe(danger)

    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(document.querySelector('.dialog')).toBeTruthy()

    dialog.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }),
    )
    expect(document.activeElement).toBe(danger)

    const cancel = [...document.querySelectorAll<HTMLButtonElement>('.dialog-footer button')].find(
      (button) => button.textContent === 'Cancel',
    )!
    cancel.click()
    await expect(result).resolves.toBe(false)
    expect(document.activeElement).toBe(before)
  })
})
