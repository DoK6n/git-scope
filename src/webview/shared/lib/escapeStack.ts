import { createEffect, onCleanup } from 'solid-js'

/**
 * Esc로 닫히는 UI의 종류. 앞에 있을수록 먼저 닫힌다.
 * gesture는 drag-to-reset처럼 진행 중인 마우스 조작이다.
 */
const LAYER_ORDER = ['gesture', 'menu', 'dialog', 'popover', 'panel', 'details'] as const
export type EscapeLayerKind = (typeof LAYER_ORDER)[number]

interface EscapeLayer {
  kind: EscapeLayerKind
  seq: number
  close: () => void
  restoreTarget: HTMLElement | null
  restoreFocus: boolean
}

/** 복귀할 요소가 사라졌을 때 포커스를 받는 영역 */
const FALLBACK_FOCUS_SELECTOR = '[data-escape-fallback]'

const layers = new Set<EscapeLayer>()
let nextSeq = 0
let listening = false

function topLayer(): EscapeLayer | undefined {
  let top: EscapeLayer | undefined
  for (const layer of layers) {
    if (!top) {
      top = layer
      continue
    }
    const rank = LAYER_ORDER.indexOf(layer.kind)
    const topRank = LAYER_ORDER.indexOf(top.kind)
    // 같은 종류면 나중에 연 쪽이 위
    if (rank < topRank || (rank === topRank && layer.seq > top.seq)) top = layer
  }
  return top
}

function restoreFocus(target: HTMLElement | null): void {
  if (target?.isConnected) {
    target.focus()
    return
  }
  document.querySelector<HTMLElement>(FALLBACK_FOCUS_SELECTOR)?.focus()
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  // IME 조합 중의 Esc는 조합 취소로 둔다
  if (e.isComposing || e.keyCode === 229) return
  const top = topLayer()
  if (!top) return

  e.preventDefault()
  e.stopImmediatePropagation()
  layers.delete(top)
  top.close()
  if (top.restoreFocus) restoreFocus(top.restoreTarget)
}

function ensureListener(): void {
  if (listening) return
  // capture 단계에서 먼저 받아 한 번의 Esc가 하나의 UI만 닫게 한다
  window.addEventListener('keydown', onKeyDown, true)
  listening = true
}

/**
 * Esc로 닫을 UI를 등록한다. 반환 함수로 등록을 해제한다.
 * restoreFocus가 true면 Esc로 닫은 뒤 등록 시점의 포커스 요소로 돌아간다.
 */
export function registerEscapeLayer(
  kind: EscapeLayerKind,
  close: () => void,
  options: { restoreFocus?: boolean } = {},
): () => void {
  ensureListener()
  const layer: EscapeLayer = {
    kind,
    seq: nextSeq++,
    close,
    restoreTarget: document.activeElement instanceof HTMLElement ? document.activeElement : null,
    restoreFocus: options.restoreFocus ?? true,
  }
  layers.add(layer)
  return () => {
    layers.delete(layer)
  }
}

/** open()이 true인 동안 Esc 레이어로 등록한다 */
export function useEscapeLayer(
  kind: EscapeLayerKind,
  open: () => boolean,
  close: () => void,
  options?: { restoreFocus?: boolean },
): void {
  createEffect(() => {
    if (!open()) return
    onCleanup(registerEscapeLayer(kind, close, options))
  })
}
