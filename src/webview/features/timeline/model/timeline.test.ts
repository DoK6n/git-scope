import { afterEach, describe, expect, it } from 'vitest'
import { timelineStore } from './timeline'

afterEach(() => {
  timelineStore.clearDateFilter()
  timelineStore.closePanel()
  timelineStore.setSelectedAuthor(null)
  timelineStore.setUnit('month')
})

describe('timelineStore', () => {
  it('keeps the top panel open and applies a date filter when a populated bucket is selected', () => {
    timelineStore.togglePanel()
    timelineStore.selectBucket({
      key: '2026-09',
      start: 10,
      end: 20,
      total: 3,
      counts: {},
    })

    expect(timelineStore.panelOpen()).toBe(true)
    expect(timelineStore.dateFilter()).toEqual({ start: 10, end: 20, label: '2026-09' })
  })

  it('clears the graph date filter and ignores empty buckets', () => {
    timelineStore.selectBucket({ key: 'filled', start: 10, end: 20, total: 1, counts: {} })
    timelineStore.clearDateFilter()
    timelineStore.selectBucket({ key: 'empty', start: 20, end: 30, total: 0, counts: {} })

    expect(timelineStore.dateFilter()).toBeNull()
  })
})
