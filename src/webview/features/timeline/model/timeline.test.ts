import { afterEach, describe, expect, it } from 'vitest'
import { timelineStore } from './timeline'

afterEach(() => {
  timelineStore.clearDateFilter()
  timelineStore.setViewMode('graph')
  timelineStore.setSelectedAuthor(null)
  timelineStore.setUnit('month')
})

describe('timelineStore', () => {
  it('returns to the graph with a date filter when a populated bucket is selected', () => {
    timelineStore.setViewMode('timeline')
    timelineStore.selectBucket({
      key: '2026-09',
      start: 10,
      end: 20,
      total: 3,
      counts: {},
    })

    expect(timelineStore.viewMode()).toBe('graph')
    expect(timelineStore.dateFilter()).toEqual({ start: 10, end: 20, label: '2026-09' })
  })

  it('clears the graph date filter and ignores empty buckets', () => {
    timelineStore.selectBucket({ key: 'filled', start: 10, end: 20, total: 1, counts: {} })
    timelineStore.clearDateFilter()
    timelineStore.setViewMode('timeline')
    timelineStore.selectBucket({ key: 'empty', start: 20, end: 30, total: 0, counts: {} })

    expect(timelineStore.viewMode()).toBe('timeline')
    expect(timelineStore.dateFilter()).toBeNull()
  })
})
