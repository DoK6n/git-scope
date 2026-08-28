import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import type { Commit, GitRef } from '@shared-types/domain'
import { graphStore } from '../../../entities/graph'
import type { Segment } from '../../../entities/graph'
import { computeDragResetPlan, confirmDragReset, dragResetStore } from '../../../features/reset'
import { searchStore } from '../../../features/search'
import { t } from '../../../shared/lib'
import { CommitRow } from './CommitRow'
import { DETAILS_H, InlineDetails } from './InlineDetails'
import { columnStore } from '../model/columns'
import { buildRowMenu } from '../model/rowMenu'
import { openContextMenu } from '../../../shared/ui'

export const ROW_H = 26
const LANE_W = 14
const NODE_R = 4
/** 노드 포인터 히트 반경 — 보이는 점(4px)보다 넉넉해야 hover/드래그를 잡기 쉽다 */
const NODE_HIT_R = 9
const OVERSCAN = 10
/** 인라인 상세 패널로 밀려난 행까지 커버하는 추가 오버스캔 */
const DETAILS_ROWS = Math.ceil(DETAILS_H / ROW_H)

function laneX(lane: number): number {
  return lane * LANE_W + LANE_W / 2 + 4
}

function segmentPath(seg: Segment, y1: number, y2: number): string {
  const x1 = laneX(seg.fromLane)
  const x2 = laneX(seg.toLane)
  if (x1 === x2) return `M ${x1} ${y1} L ${x2} ${y2}`
  // 레인 이동은 양 끝 접선이 수직인 S-커브. (과거 "펜촉/쐐기" 현상은 곡선 모양이 아니라
  // .color-N의 fill이 path 내부를 채우던 CSS 버그였다 — path.graph-line에서 fill 차단)
  const midY = (y1 + y2) / 2
  return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`
}

/** 드래그 중 뷰포트 가장자리 자동 스크롤이 시작되는 여백(px)과 프레임당 스크롤량 */
const EDGE_SCROLL_ZONE = 28
const EDGE_SCROLL_STEP = 10
/** 이 거리(px) 이상 움직여야 드래그로 판정 — 그 전 mouseup은 일반 클릭 */
const DRAG_THRESHOLD = 4
/** 움직이지 않아도 이 시간(ms) 이상 꾹 누르고 있으면 드래그 모드로 진입 */
const HOLD_DELAY = 300

export function GraphView() {
  let containerRef: HTMLDivElement | undefined
  let canvasRef: HTMLDivElement | undefined
  const [scrollTop, setScrollTop] = createSignal(0)
  const [viewHeight, setViewHeight] = createSignal(600)
  // 그래프 선 강조: hover는 일시적, 클릭은 고정(토글), 상세뷰가 열리면 그 커밋의 라인.
  // seg.color가 라인 고유 id다. reset 드래그 중에는 미리보기 dim과 섞이지 않게 전부 끈다
  const [hoverLine, setHoverLine] = createSignal<number | null>(null)
  const [pinnedLine, setPinnedLine] = createSignal<number | null>(null)
  const activeLine = () => (dragging() ? null : (hoverLine() ?? pinnedLine() ?? selectedLine()))

  onMount(() => {
    if (!containerRef) return
    const observer = new ResizeObserver(() => setViewHeight(containerRef!.clientHeight))
    observer.observe(containerRef)
    setViewHeight(containerRef.clientHeight)
    onCleanup(() => observer.disconnect())
  })

  const commits = createMemo<Commit[]>(() => graphStore.graph()?.commits ?? [])

  /** 선택된 커밋의 행 인덱스 — 이 행 바로 아래에 인라인 상세가 열린다 */
  const selectedIndex = createMemo<number | null>(() => {
    const hash = graphStore.selectedCommit()
    if (hash === null) return null
    const idx = commits().findIndex((c) => c.hash === hash)
    return idx >= 0 ? idx : null
  })

  /** 상세뷰가 열린 커밋이 속한 라인 id */
  const selectedLine = createMemo<number | null>(() => {
    const index = selectedIndex()
    if (index === null) return null
    return graphStore.layout()?.rows[index]?.color ?? null
  })

  /** 행 i의 화면 y 오프셋 — 상세 패널 아래 행들은 패널 높이만큼 밀린다 */
  const rowTop = (i: number): number => {
    const sel = selectedIndex()
    return i * ROW_H + (sel !== null && i > sel ? DETAILS_H : 0)
  }
  const nodeY = (i: number): number => rowTop(i) + ROW_H / 2

  // 검색 이동: 매치 행이 화면 중앙에 오도록 스크롤
  createEffect(() => {
    const target = searchStore.scrollTarget()
    if (target === null || !containerRef) return
    containerRef.scrollTop = Math.max(0, rowTop(target) - containerRef.clientHeight / 2)
    searchStore.consumeScrollTarget()
  })

  // 외부(스태시 패널 등)에서 요청한 행 스크롤 — 검색과 동일하게 화면 중앙 정렬
  createEffect(() => {
    const target = graphStore.scrollTargetRow()
    if (target === null || !containerRef) return
    containerRef.scrollTop = Math.max(0, rowTop(target) - containerRef.clientHeight / 2)
    graphStore.consumeScrollTarget()
  })

  // ── drag-to-reset (스펙 60-new-features §10) ─────────────────────────
  // HEAD 커밋의 노드에서 mousedown → 아래로 끌면 지나간 first-parent 커밋들이
  // "지워지는" 미리보기 → mouseup에서 확인 다이얼로그 → git reset

  /** HEAD 커밋(합성 uncommitted 노드 제외)의 행 인덱스 */
  const headRow = createMemo<number | null>(() => {
    const head = graphStore.graph()?.headHash
    if (!head) return null
    const idx = commits().findIndex((c) => c.hash === head && !c.isUncommitted)
    return idx >= 0 ? idx : null
  })

  const [dragging, setDragging] = createSignal(false)
  /** 마우스가 올라간 노드의 행 — 해당 점을 살짝 확대해 어느 커밋인지 보여준다 */
  const [hoverNode, setHoverNode] = createSignal<number | null>(null)

  /** 미리보기 dim 대상 행 인덱스 집합 (erased + 도달 불가가 되는 사이드 커밋) */
  const doomedRows = createMemo<Set<number> | null>(() => {
    const plan = dragResetStore.plan()
    if (!plan) return null
    const set = new Set<number>()
    commits().forEach((c, i) => {
      if (plan.dimmed.has(c.hash)) set.add(i)
    })
    return set
  })
  const erasedSet = createMemo<Set<string>>(
    () => new Set((dragResetStore.plan()?.erased ?? []).map((c) => c.hash)),
  )
  const resetTargetHash = () => dragResetStore.plan()?.target.hash ?? null

  /** 드래그로 끝난 mouseup 직후 같은 노드에서 click이 발생하면 선택 토글을 막는다 */
  let suppressNodeClick = false

  const startDragReset = (e: MouseEvent) => {
    if (e.button !== 0 || !containerRef || !canvasRef) return
    e.preventDefault()
    e.stopPropagation()
    suppressNodeClick = false
    const startY = e.clientY
    let lastY = e.clientY
    let active = false
    let raf: number | null = null

    const updatePlan = () => {
      const g = graphStore.graph()
      if (!g || !canvasRef) return
      const y = lastY - canvasRef.getBoundingClientRect().top
      const row = Math.max(0, Math.min(commits().length - 1, Math.floor(y / ROW_H)))
      dragResetStore.setPlan(
        computeDragResetPlan(commits(), g.refs, g.headHash, g.headBranch, row),
      )
    }

    // 커서가 가장자리에 머물러도 계속 흐르도록 rAF 루프로 스크롤한다.
    // 바닥에 닿으면 onScroll의 loadMore가 그대로 동작해 추가 커밋도 끌어올 수 있다
    const tick = () => {
      if (containerRef) {
        const rect = containerRef.getBoundingClientRect()
        if (lastY > rect.bottom - EDGE_SCROLL_ZONE) {
          containerRef.scrollTop += EDGE_SCROLL_STEP
          updatePlan()
        } else if (lastY < rect.top + EDGE_SCROLL_ZONE) {
          containerRef.scrollTop -= EDGE_SCROLL_STEP
          updatePlan()
        }
      }
      raf = requestAnimationFrame(tick)
    }

    // 드래그 모드 진입 — 임계 거리 이동 또는 꾹 누르기(HOLD_DELAY) 중 먼저 오는 쪽
    const activate = () => {
      if (active) return
      active = true
      setDragging(true)
      // 드래그 중 pointer-events가 꺼져 mouseleave가 못 오므로 hover 잔상을 직접 지운다
      setHoverLine(null)
      setHoverNode(null)
      // 상세 패널이 열려 있으면 행 y가 밀린다 — 닫아서 행 = i*ROW_H 로 단순화
      graphStore.setSelectedCommit(null)
      updatePlan()
      raf = requestAnimationFrame(tick)
    }
    const holdTimer = window.setTimeout(activate, HOLD_DELAY)

    const cleanup = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('keydown', onKey)
      window.clearTimeout(holdTimer)
      if (raf !== null) cancelAnimationFrame(raf)
      setDragging(false)
    }
    const onMove = (ev: MouseEvent) => {
      lastY = ev.clientY
      if (!active && Math.abs(ev.clientY - startY) > DRAG_THRESHOLD) activate()
      if (active) updatePlan()
    }
    const onUp = () => {
      cleanup()
      if (!active) {
        // 드래그가 아닌 단순 클릭 — 이어서 발생하는 히트 서클의 click이 선택을 처리한다
        dragResetStore.clear()
        return
      }
      suppressNodeClick = true
      if ((dragResetStore.plan()?.erased.length ?? 0) > 0) {
        void confirmDragReset() // 다이얼로그가 닫힐 때 미리보기도 함께 지워진다
      } else {
        dragResetStore.clear()
      }
    }
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape') return
      cleanup()
      dragResetStore.clear()
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('keydown', onKey)
  }

  /** 행/노드 공통 클릭 처리 — 선택 토글, Ctrl/Cmd+클릭은 비교 대상 지정 */
  const handleRowClick = (c: Commit, e: MouseEvent) => {
    if (c.isUncommitted) return
    const selected = graphStore.selectedCommit()
    if ((e.ctrlKey || e.metaKey) && selected && selected !== c.hash) {
      // Ctrl/Cmd+클릭: 선택된 커밋과 비교
      graphStore.setCompareWith(graphStore.compareWith() === c.hash ? null : c.hash)
    } else {
      graphStore.setSelectedCommit(selected === c.hash ? null : c.hash)
    }
  }

  const refsByHash = createMemo(() => {
    const map = new Map<string, GitRef[]>()
    for (const ref of graphStore.graph()?.refs ?? []) {
      const list = map.get(ref.hash)
      if (list) list.push(ref)
      else map.set(ref.hash, [ref])
    }
    return map
  })

  const range = createMemo(() => {
    // 상세 패널이 열려 있으면 그 위쪽 인덱스가 더 아래 y에 그려질 수 있으므로 여유분을 더 둔다
    const start = Math.max(0, Math.floor(scrollTop() / ROW_H) - OVERSCAN - DETAILS_ROWS)
    const end = Math.min(
      commits().length,
      Math.ceil((scrollTop() + viewHeight()) / ROW_H) + OVERSCAN,
    )
    return { start, end }
  })

  const visibleIndices = createMemo(() => {
    const { start, end } = range()
    const indices: number[] = []
    for (let i = start; i < end; i++) indices.push(i)
    return indices
  })

  const visibleSegments = createMemo(() => {
    const layout = graphStore.layout()
    if (!layout) return []
    const { start, end } = range()
    // MVP: 선형 필터. 대형 리포에서 병목이 되면 row 인덱스 도입
    return layout.segments.filter((s) => s.row >= start - 1 && s.row < end)
  })

  // 로드된 커밋 전체의 최대 레인 수에 맞춰 늘어난다 — 무한 스크롤로 추가 로드되면
  // 레이아웃이 재계산되면서 자동으로 갱신된다. 헤더 드래그로 수동 조절 가능
  const graphWidth = createMemo(() => {
    const manual = columnStore.graphManual()
    if (manual !== null) return manual
    const lanes = graphStore.layout()?.laneCount ?? 1
    return lanes * LANE_W + 8
  })

  const totalHeight = createMemo(
    () => commits().length * ROW_H + (selectedIndex() !== null ? DETAILS_H : 0),
  )

  const onScroll = (e: Event) => {
    const el = e.currentTarget as HTMLDivElement
    setScrollTop(el.scrollTop)
    if (el.scrollTop + el.clientHeight > el.scrollHeight - ROW_H * 20) {
      void graphStore.loadMore()
    }
  }

  const dividerFor = (column: 'author' | 'date' | 'hash') => (
    <div
      class="col-divider"
      onMouseDown={(e) =>
        columnStore.startDrag(
          e,
          () => columnStore.widths()[column],
          (px) => columnStore.setWidth(column, px),
          -1, // 컬럼의 왼쪽 경계 — 왼쪽으로 끌면 넓어진다
        )
      }
      onDblClick={() => containerRef && columnStore.autoFit(containerRef, column)}
    />
  )

  return (
    <div
      class="graph-view"
      classList={{ 'dragging-reset': dragging() }}
      ref={(el) => (containerRef = el)}
      onScroll={onScroll}
      style={{
        '--col-author-w': `${columnStore.widths().author}px`,
        '--col-date-w': `${columnStore.widths().date}px`,
        '--col-hash-w': `${columnStore.widths().hash}px`,
      }}
    >
      <div class="graph-header">
        <div class="hcell" style={{ width: `${graphWidth()}px` }}>
          Graph
          <div
            class="col-divider"
            onMouseDown={(e) =>
              columnStore.startDrag(
                e,
                graphWidth,
                (px) => columnStore.setGraphManual(Math.max(24, Math.round(px))),
                1, // 오른쪽 경계 — 오른쪽으로 끌면 넓어진다
              )
            }
            onDblClick={() => columnStore.setGraphManual(null)}
            title={t('Double-click: fit to lane count')}
          />
        </div>
        <div class="hcell hcell-flex">
          Commit
          {dividerFor('author')}
        </div>
        <div class="hcell" style={{ width: 'var(--col-author-w)' }}>
          Author
          {dividerFor('date')}
        </div>
        <div class="hcell" style={{ width: 'var(--col-date-w)' }}>
          Date
          {dividerFor('hash')}
        </div>
        <div class="hcell" style={{ width: 'var(--col-hash-w)' }}>
          Hash
        </div>
      </div>
      <div
        class="graph-canvas"
        ref={(el) => (canvasRef = el)}
        style={{ height: `${totalHeight()}px` }}
      >
        <For each={visibleIndices()}>
          {(i) => {
            const commit = () => commits()[i]
            return (
              <Show when={commit()}>
                <CommitRow
                  commit={commit()!}
                  top={rowTop(i)}
                  graphWidth={graphWidth()}
                  refs={refsByHash().get(commit()!.hash) ?? []}
                  colorIndex={graphStore.layout()?.rows[i]?.color ?? 0}
                  selected={graphStore.selectedCommit() === commit()!.hash}
                  compared={graphStore.compareWith() === commit()!.hash}
                  searchMatch={searchStore.matchSet().has(i)}
                  searchCurrent={searchStore.currentRow() === i}
                  resetDoomed={doomedRows()?.has(i) ?? false}
                  resetErased={erasedSet().has(commit()!.hash)}
                  resetNewHead={resetTargetHash() === commit()!.hash}
                  onClick={(e) => handleRowClick(commit()!, e)}
                  onContextMenu={(e) => {
                    const items = buildRowMenu(commit()!)
                    if (items.length > 0) openContextMenu(e, items)
                  }}
                />
              </Show>
            )
          }}
        </For>
        {/* 그래프 SVG는 행 위 레이어 — 선의 hover/클릭 이벤트를 받기 위함.
            svg 자체는 pointer-events: none이라 선 밖 클릭은 아래 행으로 통과한다 */}
        <svg
          class="graph-svg"
          width={graphWidth()}
          height={totalHeight()}
          style={{ width: `${graphWidth()}px`, height: `${totalHeight()}px` }}
        >
          <For each={visibleSegments()}>
            {(seg) => {
              const d = () => segmentPath(seg, nodeY(seg.row), nodeY(seg.row + 1))
              // reset 미리보기: dim된 커밋에서 출발한 엣지의 선분은 전부 지운다 —
              // 자식→부모 엣지가 다른 브랜치 행을 통과하며 여러 선분으로 쪼개져도
              // childRow가 같으므로 함께 사라진다. 살아남는 커밋의 엣지는 남는다
              // (자식이 살아남으면 그 부모도 도달 가능해 dim되지 않는다)
              const doomed = () => doomedRows()?.has(seg.childRow) ?? false
              return (
                <>
                  <path
                    d={d()}
                    class={`graph-line color-${seg.color % 8}`}
                    classList={{
                      active: activeLine() === seg.color,
                      dimmed: activeLine() !== null && activeLine() !== seg.color,
                      doomed: doomed(),
                    }}
                    fill="none"
                  />
                  <path
                    d={d()}
                    class="graph-line-hit"
                    onMouseEnter={() => setHoverLine(seg.color)}
                    onMouseLeave={() => setHoverLine(null)}
                    onClick={(e) => {
                      e.stopPropagation()
                      setPinnedLine(pinnedLine() === seg.color ? null : seg.color)
                    }}
                  />
                </>
              )
            }}
          </For>
          <For each={visibleIndices()}>
            {(i) => {
              const row = () => graphStore.layout()?.rows[i]
              const commit = () => commits()[i]
              return (
                <Show when={row() && commit()}>
                  <circle
                    cx={laneX(row()!.lane)}
                    cy={nodeY(i)}
                    // 확대는 hover된 그 점 하나만 — 라인 강조는 선 굵기로만 표현한다
                    r={hoverNode() === i ? NODE_R + 2.5 : NODE_R}
                    class={`graph-node color-${row()!.color % 8}`}
                    classList={{
                      uncommitted: commit()!.isUncommitted,
                      stash: commit()!.stashSelector !== undefined,
                      dimmed: activeLine() !== null && activeLine() !== row()!.color,
                      doomed: doomedRows()?.has(i) ?? false,
                    }}
                  />
                  {/* 보이는 점(4px)은 잡기 너무 작다 — 투명한 히트 서클이 hover 확대,
                      클릭(행 선택), HEAD 노드의 drag-to-reset을 대신 받는다 */}
                  <circle
                    cx={laneX(row()!.lane)}
                    cy={nodeY(i)}
                    r={NODE_HIT_R}
                    class="graph-node-hit"
                    classList={{ 'head-node': headRow() === i }}
                    onMouseEnter={() => setHoverNode(i)}
                    onMouseLeave={() => setHoverNode(null)}
                    onMouseDown={(e) => {
                      if (headRow() === i) startDragReset(e)
                    }}
                    onClick={(e) => {
                      if (suppressNodeClick) {
                        suppressNodeClick = false
                        return
                      }
                      handleRowClick(commit()!, e)
                    }}
                  >
                    <Show when={headRow() === i}>
                      <title>{t('Drag down: reset (erase commits)')}</title>
                    </Show>
                  </circle>
                </Show>
              )
            }}
          </For>
        </svg>
        <Show when={selectedIndex() !== null}>
          <InlineDetails top={(selectedIndex()! + 1) * ROW_H} left={graphWidth()} />
        </Show>
      </div>
      <Show when={graphStore.loading()}>
        <div class="graph-loading">Loading…</div>
      </Show>
    </div>
  )
}
