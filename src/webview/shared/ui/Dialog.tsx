import type { JSX, ParentComponent } from 'solid-js'
import { Show } from 'solid-js'

interface DialogProps {
  open: boolean
  title: string
  onClose: () => void
  /** 하단 버튼 영역 */
  footer?: JSX.Element
}

/** 모든 다이얼로그의 공통 골격 — 오버레이 + 타이틀 + 본문 + 푸터 */
export const Dialog: ParentComponent<DialogProps> = (props) => {
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
