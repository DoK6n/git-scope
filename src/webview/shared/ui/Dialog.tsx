import type { JSX, ParentComponent } from 'solid-js'
import { createEffect, onCleanup, Show } from 'solid-js'

interface DialogProps {
  open: boolean
  title: string
  onClose: () => void
  /** 단일 행 입력에서 Enter로 폼을 확정할 때 호출 */
  onConfirm?: () => void
  /** 하단 버튼 영역 */
  footer?: JSX.Element
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function focusInitialElement(dialog: HTMLDivElement) {
  const input = dialog.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    'input:not([disabled]):not([type="hidden"]), textarea:not([disabled])',
  )
  if (!input) {
    dialog.focus()
    return
  }

  input.focus()
  if (input.value === '') return

  try {
    input.select()
  } catch {
    // number inputs cannot expose a text selection in every browser, but still keep focus.
  }
}

/** 모든 다이얼로그의 공통 골격 — 오버레이 + 타이틀 + 본문 + 푸터. Esc로 닫힌다 */
export const Dialog: ParentComponent<DialogProps> = (props) => {
  let dialogRef: HTMLDivElement | undefined

  createEffect(() => {
    if (!props.open) return

    const restoreTarget = document.activeElement instanceof HTMLElement ? document.activeElement : null
    queueMicrotask(() => {
      if (dialogRef?.isConnected) focusInitialElement(dialogRef)
    })

    onCleanup(() => {
      if (restoreTarget?.isConnected) restoreTarget.focus()
    })
  })

  const onKey = (e: KeyboardEvent) => {
    if (!props.open) return

    if (e.key === 'Escape') {
      e.stopPropagation() // 뒤의 find 위젯 등 다른 Esc 처리로 번지지 않게
      props.onClose()
      return
    }

    if (
      e.key === 'Enter' &&
      !e.isComposing &&
      props.onConfirm &&
      e.target instanceof HTMLInputElement &&
      (e.target.type === 'text' || e.target.type === 'number')
    ) {
      e.preventDefault()
      e.stopPropagation()
      props.onConfirm()
      return
    }

    if (e.key === 'Tab' && dialogRef) {
      const focusable = [...dialogRef.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)]
      if (focusable.length === 0) {
        e.preventDefault()
        dialogRef.focus()
        return
      }

      const active = document.activeElement
      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!
      if (e.shiftKey && (active === dialogRef || active === first || !dialogRef.contains(active))) {
        e.preventDefault()
        last.focus()
      } else if (
        !e.shiftKey &&
        (active === dialogRef || active === last || !dialogRef.contains(active))
      ) {
        e.preventDefault()
        first.focus()
      }
    }
  }
  window.addEventListener('keydown', onKey)
  onCleanup(() => window.removeEventListener('keydown', onKey))
  return (
    <Show when={props.open}>
      <div class="dialog-overlay" onClick={() => props.onClose()}>
        <div
          ref={(element) => (dialogRef = element)}
          class="dialog"
          role="dialog"
          aria-modal="true"
          aria-label={props.title}
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
        >
          <div class="dialog-title">{props.title}</div>
          <div class="dialog-body">{props.children}</div>
          <Show when={props.footer}>
            <div class="dialog-footer">{props.footer}</div>
          </Show>
        </div>
      </div>
    </Show>
  )
}
