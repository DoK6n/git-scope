import type { JSX, ParentComponent } from 'solid-js'
import { onCleanup, Show } from 'solid-js'

interface DialogProps {
  open: boolean
  title: string
  onClose: () => void
  /** 하단 버튼 영역 */
  footer?: JSX.Element
}

/** 모든 다이얼로그의 공통 골격 — 오버레이 + 타이틀 + 본문 + 푸터. Esc로 닫힌다 */
export const Dialog: ParentComponent<DialogProps> = (props) => {
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && props.open) {
      e.stopPropagation() // 뒤의 find 위젯 등 다른 Esc 처리로 번지지 않게
      props.onClose()
    }
  }
  window.addEventListener('keydown', onKey)
  onCleanup(() => window.removeEventListener('keydown', onKey))
  return (
    <Show when={props.open}>
      <div class="dialog-overlay" onClick={() => props.onClose()}>
        <div class="dialog" onClick={(e) => e.stopPropagation()}>
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
