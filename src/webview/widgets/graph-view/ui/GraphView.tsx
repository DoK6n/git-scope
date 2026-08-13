import { createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import type { Commit, GitRef } from '@shared-types/domain'
import { graphStore } from '../../../entities/graph'
import type { Segment } from '../../../entities/graph'
import { CommitRow } from './CommitRow'
import { buildRowMenu } from '../model/rowMenu'
import { openContextMenu } from '../../../shared/ui'

export const ROW_H = 26
const LANE_W = 14
const NODE_R = 4
const OVERSCAN = 10
/** 그래프 컬럼이 무한히 넓어지지 않도록 표시 레인 수 제한 */
const MAX_VISIBLE_LANES = 16

function laneX(lane: number): number {
  return lane * LANE_W + LANE_W / 2 + 4
}

function segmentPath(seg: Segment): string {
  const x1 = laneX(seg.fromLane)
  const x2 = laneX(seg.toLane)
  const y1 = seg.row * ROW_H + ROW_H / 2
  const y2 = y1 + ROW_H
  if (x1 === x2) return `M ${x1} ${y1} L ${x2} ${y2}`
  const midY = ROW_H / 2
  return `M ${x1} ${y1} C ${x1} ${y1 + midY}, ${x2} ${y2 - midY}, ${x2} ${y2}`
}

export function GraphView() {
  let containerRef: HTMLDivElement | undefined
  const [scrollTop, setScrollTop] = createSignal(0)
  const [viewHeight, setViewHeight] = createSignal(600)

  onMount(() => {
    if (!containerRef) return
    const observer = new ResizeObserver(() => setViewHeight(containerRef!.clientHeight))
    observer.observe(containerRef)
    setViewHeight(containerRef.clientHeight)
    onCleanup(() => observer.disconnect())
  })

  const commits = createMemo<Commit[]>(() => graphStore.graph()?.commits ?? [])

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
    const start = Math.max(0, Math.floor(scrollTop() / ROW_H) - OVERSCAN)
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

  const graphWidth = createMemo(() => {
    const lanes = Math.min(graphStore.layout()?.laneCount ?? 1, MAX_VISIBLE_LANES)
    return lanes * LANE_W + 8
  })

  const totalHeight = createMemo(() => commits().length * ROW_H)

  const onScroll = (e: Event) => {
    const el = e.currentTarget as HTMLDivElement
    setScrollTop(el.scrollTop)
    if (el.scrollTop + el.clientHeight > el.scrollHeight - ROW_H * 20) {
      void graphStore.loadMore()
    }
  }

  return (
    <div class="graph-view" ref={containerRef} onScroll={onScroll}>
      <div class="graph-canvas" style={{ height: `${totalHeight()}px` }}>
        <svg
          class="graph-svg"
          width={graphWidth()}
          height={totalHeight()}
          style={{ width: `${graphWidth()}px`, height: `${totalHeight()}px` }}
        >
          <For each={visibleSegments()}>
            {(seg) => (
              <path
                d={segmentPath(seg)}
                class={`graph-line color-${seg.color % 8}`}
                fill="none"
              />
            )}
          </For>
          <For each={visibleIndices()}>
            {(i) => {
              const row = () => graphStore.layout()?.rows[i]
              const commit = () => commits()[i]
              return (
                <Show when={row() && commit()}>
                  <circle
                    cx={laneX(row()!.lane)}
                    cy={i * ROW_H + ROW_H / 2}
                    r={NODE_R}
                    class={`graph-node color-${row()!.color % 8}`}
                    classList={{ uncommitted: commit()!.isUncommitted }}
                  />
                </Show>
              )
            }}
          </For>
        </svg>
        <For each={visibleIndices()}>
          {(i) => {
            const commit = () => commits()[i]
            return (
              <Show when={commit()}>
                <CommitRow
                  commit={commit()!}
                  top={i * ROW_H}
                  graphWidth={graphWidth()}
                  refs={refsByHash().get(commit()!.hash) ?? []}
                  selected={graphStore.selectedCommit() === commit()!.hash}
                  onClick={() => {
                    if (!commit()!.isUncommitted) {
                      graphStore.setSelectedCommit(
                        graphStore.selectedCommit() === commit()!.hash ? null : commit()!.hash,
                      )
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
      </div>
      <Show when={graphStore.loading()}>
        <div class="graph-loading">Loading…</div>
      </Show>
    </div>
  )
}
