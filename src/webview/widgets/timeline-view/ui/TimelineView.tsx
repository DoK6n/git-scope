import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import { graphStore } from '../../../entities/graph'
import { buildTimeline, timelineStore } from '../../../features/timeline'
import type { TimelineAuthor, TimelineBucket } from '../../../features/timeline'
import { t } from '../../../shared/lib'

const CHART_H = 320
const PLOT_TOP = 20
const PLOT_BOTTOM = 260
const SLOT_W = 44
const BAR_W = 28
const LEFT = 42
const RIGHT = 18

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
  let containerRef: HTMLDivElement | undefined
  const [availableWidth, setAvailableWidth] = createSignal(640)
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
  const chartWidth = createMemo(() =>
    Math.max(availableWidth(), LEFT + RIGHT + data().buckets.length * SLOT_W),
  )
  const slotWidth = createMemo(() =>
    data().buckets.length === 0
      ? SLOT_W
      : (chartWidth() - LEFT - RIGHT) / data().buckets.length,
  )
  const maxCount = createMemo(() => Math.max(1, ...data().buckets.map((bucket) => bucket.total)))
  const labelStep = createMemo(() => Math.max(1, Math.ceil(data().buckets.length / 12)))

  onMount(() => {
    if (!containerRef) return
    const observer = new ResizeObserver(() => setAvailableWidth(Math.max(320, containerRef!.clientWidth)))
    observer.observe(containerRef)
    setAvailableWidth(Math.max(320, containerRef.clientWidth))
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
    <div class="timeline-view" ref={(element) => (containerRef = element)}>
      <div class="timeline-controls">
        <div>
          <h2>{t('Commit Timeline')}</h2>
          <div class="timeline-scope">
            {t(
              '{0} of {1} currently loaded commits',
              data().commitCount,
              loadedCommitCount(),
            )}
          </div>
        </div>
        <div class="timeline-control-group">
          <label>
            {t('Author')}
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
        fallback={<div class="empty-state">{t('No loaded commits to show.')}</div>}
      >
        <div class="timeline-chart-scroll">
          <svg
            class="timeline-chart"
            width={chartWidth()}
            height={CHART_H}
            viewBox={`0 0 ${chartWidth()} ${CHART_H}`}
            aria-label={t('Commit activity timeline')}
          >
            <line class="timeline-axis" x1={LEFT} y1={PLOT_BOTTOM} x2={chartWidth() - RIGHT} y2={PLOT_BOTTOM} />
            <text class="timeline-axis-label" x={LEFT - 8} y={PLOT_TOP + 4} text-anchor="end">
              {maxCount()}
            </text>
            <text class="timeline-axis-label" x={LEFT - 8} y={PLOT_BOTTOM + 4} text-anchor="end">
              0
            </text>
            <For each={data().buckets}>
              {(bucket, index) => {
                const x = () => LEFT + index() * slotWidth() + (slotWidth() - BAR_W) / 2
                let cumulative = 0
                return (
                  <g
                    class="timeline-bucket"
                    classList={{ empty: bucket.total === 0 }}
                    role="button"
                    tabIndex={bucket.total > 0 ? 0 : -1}
                    aria-label={bucketDescription(bucket, displayedAuthors())}
                    onClick={() => openBucket(bucket)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return
                      event.preventDefault()
                      openBucket(bucket)
                    }}
                  >
                    <title>{bucketDescription(bucket, displayedAuthors())}</title>
                    <For each={displayedAuthors()}>
                      {(author) => {
                        const count = bucket.counts[author.key] ?? 0
                        const height = (count / maxCount()) * (PLOT_BOTTOM - PLOT_TOP)
                        cumulative += height
                        const y = PLOT_BOTTOM - cumulative
                        const color = data().authors.findIndex((item) => item.key === author.key) % 8
                        return (
                          <Show when={count > 0}>
                            <rect
                              class={`timeline-bar color-${color}`}
                              x={x()}
                              y={y}
                              width={BAR_W}
                              height={height}
                            />
                          </Show>
                        )
                      }}
                    </For>
                    <Show when={bucket.total === 0}>
                      <line class="timeline-empty-mark" x1={x()} x2={x() + BAR_W} y1={PLOT_BOTTOM} y2={PLOT_BOTTOM} />
                    </Show>
                    <Show when={index() % labelStep() === 0 || index() === data().buckets.length - 1}>
                      <text
                        class="timeline-bucket-label"
                        x={x() + BAR_W / 2}
                        y={PLOT_BOTTOM + 18}
                        text-anchor="middle"
                      >
                        {bucket.key}
                      </text>
                    </Show>
                  </g>
                )
              }}
            </For>
          </svg>
        </div>
        <div class="timeline-legend" aria-label={t('Timeline authors')}>
          <For each={displayedAuthors()}>
            {(author) => {
              const color = () => data().authors.findIndex((item) => item.key === author.key) % 8
              return (
                <span class="timeline-legend-item">
                  <span class={`timeline-legend-swatch color-${color()}`} />
                  {authorLabel(author)}
                </span>
              )
            }}
          </For>
        </div>
      </Show>
    </div>
  )
}
