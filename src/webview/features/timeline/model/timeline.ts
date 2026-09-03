import { createSignal } from 'solid-js'
import type { TimelineBucket, TimelineRange, TimelineUnit } from '../lib/timeline'

export type TimelineViewMode = 'graph' | 'timeline'

const [viewMode, setViewMode] = createSignal<TimelineViewMode>('graph')
const [unit, setUnit] = createSignal<TimelineUnit>('month')
const [selectedAuthor, setSelectedAuthor] = createSignal<string | null>(null)
const [dateFilter, setDateFilter] = createSignal<TimelineRange | null>(null)

function selectBucket(bucket: TimelineBucket): void {
  if (bucket.total === 0) return
  setDateFilter({ start: bucket.start, end: bucket.end, label: bucket.key })
  setViewMode('graph')
}

function clearDateFilter(): void {
  setDateFilter(null)
}

export const timelineStore = {
  viewMode,
  setViewMode,
  unit,
  setUnit,
  selectedAuthor,
  setSelectedAuthor,
  dateFilter,
  selectBucket,
  clearDateFilter,
}
