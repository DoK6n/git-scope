import { createSignal } from 'solid-js'

export type ResizableColumn = 'author' | 'date' | 'hash'

const MIN_W = 40
const DEFAULTS: Record<ResizableColumn, number> = { author: 130, date: 120, hash: 70 }

const [widths, setWidths] = createSignal<Record<ResizableColumn, number>>({ ...DEFAULTS })
/** 그래프 컬럼 수동 폭 — null이면 레인 수 기반 자동 */
const [graphManual, setGraphManual] = createSignal<number | null>(null)

function setWidth(column: ResizableColumn, px: number): void {
  setWidths((w) => ({ ...w, [column]: Math.max(MIN_W, Math.round(px)) }))
}

/**
 * 헤더 경계 드래그 시작. deltaSign: 드래그 방향과 폭 증가 방향의 관계
 * (컬럼 왼쪽 경계를 잡으면 -1, 오른쪽 경계면 +1)
 */
function startDrag(
  e: MouseEvent,
  getWidth: () => number,
  apply: (px: number) => void,
  deltaSign: 1 | -1,
): void {
  e.preventDefault()
  const startX = e.clientX
  const startW = getWidth()
  const onMove = (ev: MouseEvent) => {
    apply(startW + deltaSign * (ev.clientX - startX))
  }
  const onUp = () => {
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

/** 지금 렌더된(보이는) 행들에서 해당 컬럼 콘텐츠의 최대 폭을 재서 맞춘다 */
function autoFit(container: HTMLElement, column: ResizableColumn): void {
  let max = MIN_W
  for (const cell of container.querySelectorAll<HTMLElement>(`.commit-row .col-${column}`)) {
    // overflow hidden 셀의 scrollWidth = 실제 콘텐츠 폭
    max = Math.max(max, cell.scrollWidth)
  }
  setWidth(column, max + 12)
}

export const columnStore = {
  widths,
  setWidth,
  graphManual,
  setGraphManual,
  startDrag,
  autoFit,
}
