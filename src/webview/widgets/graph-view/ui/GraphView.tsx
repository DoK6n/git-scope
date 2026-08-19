import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import type { Commit, GitRef } from '@shared-types/domain'
import { graphStore } from '../../../entities/graph'
import type { Segment } from '../../../entities/graph'
import { searchStore } from '../../../features/search'
import { CommitRow } from './CommitRow'
import { DETAILS_H, InlineDetails } from './InlineDetails'
import { columnStore } from '../model/columns'
import { buildRowMenu } from '../model/rowMenu'
import { openContextMenu } from '../../../shared/ui'

export const ROW_H = 26
const LANE_W = 14
const NODE_R = 4
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

export function GraphView() {
  let containerRef: HTMLDivElement | undefined
  const [scrollTop, setScrollTop] = createSignal(0)
  const [viewHeight, setViewHeight] = createSignal(600)
  // 그래프 선 강조: hover는 일시적, 클릭은 고정(토글). seg.color가 라인 고유 id다
  const [hoverLine, setHoverLine] = createSignal<number | null>(null)
  const [pinnedLine, setPinnedLine] = createSignal<number | null>(null)
  const activeLine = () => hoverLine() ?? pinnedLine()

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
      ref={containerRef}
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
            title="더블클릭: 레인 수에 맞춤"
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
      <div class="graph-canvas" style={{ height: `${totalHeight()}px` }}>
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
                  onClick={(e) => {
                    const c = commit()!
                    if (c.isUncommitted) return
                    const selected = graphStore.selectedCommit()
                    if ((e.ctrlKey || e.metaKey) && selected && selected !== c.hash) {
                      // Ctrl/Cmd+클릭: 선택된 커밋과 비교
                      graphStore.setCompareWith(
                        graphStore.compareWith() === c.hash ? null : c.hash,
                      )
                    } else {
                      graphStore.setSelectedCommit(selected === c.hash ? null : c.hash)
                    }
                  }}
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
              return (
                <>
                  <path
                    d={d()}
                    class={`graph-line color-${seg.color % 8}`}
                    classList={{
                      active: activeLine() === seg.color,
                      dimmed: activeLine() !== null && activeLine() !== seg.color,
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
                    r={activeLine() === row()!.color ? NODE_R + 1 : NODE_R}
                    class={`graph-node color-${row()!.color % 8}`}
                    classList={{
                      uncommitted: commit()!.isUncommitted,
                      stash: commit()!.stashSelector !== undefined,
                      dimmed: activeLine() !== null && activeLine() !== row()!.color,
                    }}
                  />
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
