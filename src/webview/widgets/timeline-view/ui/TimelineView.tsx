import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import { graphStore } from '../../../entities/graph'
import { buildTimeline, timelineStore } from '../../../features/timeline'
import type { TimelineAuthor, TimelineBucket } from '../../../features/timeline'
import { t } from '../../../shared/lib'

const CHART_H = 112
const PLOT_TOP = 8
const PLOT_BOTTOM = 86
const LEFT = 8
const RIGHT = 8

function authorLabel(author: TimelineAuthor): string {
  return `${author.name} <${author.email}>`
}

function bucketDescription(bucket: TimelineBucket, authors: TimelineAuthor[]): string {
  const parts = authors
    .map((author) => ({ author, count: bucket.counts[author.key] ?? 0 }))
    .filter(({ count }) => count > 0)
    .map(({ author, count }) => `${author.name}: ${count}`)
  return `${t('{0}: {1} commits', bucket.key, bucket.total)}${parts.length > 0 ? `. ${parts.join(', ')}` : ''}`
}

export function TimelineView() {
  let containerRef: HTMLElement | undefined
  const [availableWidth, setAvailableWidth] = createSignal(640)
  const [hoveredIndex, setHoveredIndex] = createSignal<number | null>(null)
  const data = createMemo(() =>
    buildTimeline(
      graphStore.graph()?.commits ?? [],
      timelineStore.unit(),
      timelineStore.selectedAuthor(),
    ),
  )
  const loadedCommitCount = createMemo(
    () => buildTimeline(graphStore.graph()?.commits ?? [], timelineStore.unit()).commitCount,
  )
  const displayedAuthors = createMemo(() => {
    const selected = timelineStore.selectedAuthor()
    return selected === null
      ? data().authors
      : data().authors.filter((author) => author.key === selected)
  })
  const chartWidth = createMemo(() => Math.max(320, availableWidth()))
  const slotWidth = createMemo(() =>
    Math.max(1, (chartWidth() - LEFT - RIGHT) / Math.max(1, data().buckets.length)),
  )
  const maxCount = createMemo(() => Math.max(1, ...data().buckets.map((bucket) => bucket.total)))
  const points = createMemo(() =>
    data().buckets.map((bucket, index) => ({
      bucket,
      x: LEFT + (index + 0.5) * slotWidth(),
      y: PLOT_BOTTOM - (bucket.total / maxCount()) * (PLOT_BOTTOM - PLOT_TOP),
    })),
  )
  const linePath = createMemo(() =>
    points().map((point) => `${point.x} ${point.y}`).join(' L '),
  )
  const areaPath = createMemo(() => {
    const all = points()
    if (all.length === 0) return ''
    return `M ${all[0]!.x} ${PLOT_BOTTOM} L ${linePath()} L ${all.at(-1)!.x} ${PLOT_BOTTOM} Z`
  })
  const hoveredPoint = createMemo(() => {
    const index = hoveredIndex()
    return index === null ? null : (points()[index] ?? null)
  })
  const tooltipLeft = createMemo(() => {
    const point = hoveredPoint()
    if (!point) return 8
    return Math.max(8, Math.min(point.x - 110, chartWidth() - 228))
  })

  onMount(() => {
    if (!containerRef) return
    const observer = new ResizeObserver(() =>
      setAvailableWidth(Math.max(320, containerRef!.clientWidth - 20)),
    )
    observer.observe(containerRef)
    setAvailableWidth(Math.max(320, containerRef.clientWidth - 20))
    onCleanup(() => observer.disconnect())
  })

  createEffect(() => {
    const selected = timelineStore.selectedAuthor()
    if (selected !== null && !data().authors.some((author) => author.key === selected)) {
      timelineStore.setSelectedAuthor(null)
    }
  })

  const openBucket = (bucket: TimelineBucket) => {
    timelineStore.selectBucket(bucket)
    const first = (graphStore.graph()?.commits ?? []).find(
      (commit) =>
        !commit.isUncommitted &&
        commit.stashSelector === undefined &&
        commit.authorDate >= bucket.start &&
        commit.authorDate < bucket.end,
    )
    if (first) graphStore.setSelectedCommit(first.hash)
  }

  return (
    <section class="timeline-panel" ref={(element) => (containerRef = element)}>
      <div class="timeline-controls">
        <div class="timeline-summary">
          <strong>{t('Commit Timeline')}</strong>
          <span class="timeline-scope">
            {t('{0} of {1} currently loaded commits', data().commitCount, loadedCommitCount())}
          </span>
        </div>
        <div class="timeline-control-group">
          <label>
            <span>{t('Author')}</span>
            <select
              aria-label={t('Timeline author')}
              value={timelineStore.selectedAuthor() ?? ''}
              onChange={(event) =>
                timelineStore.setSelectedAuthor(event.currentTarget.value || null)
              }
            >
              <option value="">{t('All authors')}</option>
              <For each={data().authors}>
                {(author) => <option value={author.key}>{authorLabel(author)}</option>}
              </For>
            </select>
          </label>
          <div class="timeline-unit-toggle" role="group" aria-label={t('Timeline interval')}>
            <For each={['day', 'month', 'year'] as const}>
              {(unit) => (
                <button
                  class="toolbar-btn"
                  classList={{ primary: timelineStore.unit() === unit }}
                  onClick={() => timelineStore.setUnit(unit)}
                >
                  {t(unit[0]!.toUpperCase() + unit.slice(1))}
                </button>
              )}
            </For>
          </div>
        </div>
      </div>

      <Show
        when={data().buckets.length > 0}
        fallback={<div class="timeline-empty">{t('No loaded commits to show.')}</div>}
      >
        <div class="timeline-chart-wrap" onMouseLeave={() => setHoveredIndex(null)}>
          <svg
            class="timeline-chart"
            width={chartWidth()}
            height={CHART_H}
            viewBox={`0 0 ${chartWidth()} ${CHART_H}`}
            aria-label={t('Commit activity timeline')}
          >
            <line
              class="timeline-axis"
              x1={LEFT}
              y1={PLOT_BOTTOM}
              x2={chartWidth() - RIGHT}
              y2={PLOT_BOTTOM}
            />
            <path class="timeline-area" d={areaPath()} />
            <path class="timeline-line" d={`M ${linePath()}`} />
            <For each={points()}>
              {(point, index) => (
                <g
                  class="timeline-bucket"
                  classList={{ empty: point.bucket.total === 0 }}
                  role="button"
                  tabIndex={point.bucket.total > 0 ? 0 : -1}
                  aria-label={bucketDescription(point.bucket, displayedAuthors())}
                  onMouseEnter={() => setHoveredIndex(index())}
                  onFocus={() => setHoveredIndex(index())}
                  onBlur={() => setHoveredIndex(null)}
                  onClick={() => openBucket(point.bucket)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return
                    event.preventDefault()
                    openBucket(point.bucket)
                  }}
                >
                  <rect
                    class="timeline-bucket-hit"
                    x={LEFT + index() * slotWidth()}
                    y={PLOT_TOP}
                    width={slotWidth()}
                    height={PLOT_BOTTOM - PLOT_TOP}
                  />
                  <Show when={point.bucket.total > 0}>
                    <circle class="timeline-point" cx={point.x} cy={point.y} r="2.5" />
                  </Show>
                </g>
              )}
            </For>
            <Show when={hoveredPoint()}>
              {(point) => (
                <line
                  class="timeline-hover-line"
                  x1={point().x}
                  y1={PLOT_TOP}
                  x2={point().x}
                  y2={PLOT_BOTTOM}
                />
              )}
            </Show>
            <text class="timeline-bucket-label" x={LEFT} y={CHART_H - 7}>
              {data().buckets[0]?.key}
            </text>
            <text
              class="timeline-bucket-label"
              x={chartWidth() - RIGHT}
              y={CHART_H - 7}
              text-anchor="end"
            >
              {data().buckets.at(-1)?.key}
            </text>
          </svg>
          <Show when={hoveredPoint()}>
            {(point) => (
              <div class="timeline-tooltip" style={{ left: `${tooltipLeft()}px` }} role="status">
                <strong>{point().bucket.key}</strong>
                <span>{t('{0} commits', point().bucket.total)}</span>
                <For
                  each={displayedAuthors().filter(
                    (author) => (point().bucket.counts[author.key] ?? 0) > 0,
                  )}
                >
                  {(author) => (
                    <span>
                      {author.name}: {point().bucket.counts[author.key]}
                    </span>
                  )}
                </For>
              </div>
            )}
          </Show>
        </div>
      </Show>
    </section>
  )
}
