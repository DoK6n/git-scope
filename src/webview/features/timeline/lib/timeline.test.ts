import { describe, expect, it } from 'vitest'
import type { Commit } from '@shared-types/domain'
import { authorKey, buildTimeline, filterCommitsByRange } from './timeline'

function timestamp(year: number, month: number, day: number, hour = 12): number {
  return new Date(year, month - 1, day, hour).getTime() / 1000
}

function commit(
  hash: string,
  date: number,
  author = 'Ada',
  authorEmail = 'ada@example.com',
): Commit {
  return {
    hash,
    parents: [],
    author,
    authorEmail,
    authorDate: date,
    commitDate: date,
    subject: hash,
  }
}

describe('buildTimeline', () => {
  it('creates continuous local day buckets and excludes synthetic rows', () => {
    const commits = [
      commit('a', timestamp(2026, 2, 1)),
      commit('b', timestamp(2026, 2, 3)),
      { ...commit('working', timestamp(2026, 2, 2)), isUncommitted: true },
      { ...commit('stash', timestamp(2026, 2, 2)), stashSelector: 'stash@{0}' },
    ]

    const result = buildTimeline(commits, 'day')

    expect(result.buckets.map((bucket) => [bucket.key, bucket.total])).toEqual([
      ['2026-02-01', 1],
      ['2026-02-02', 0],
      ['2026-02-03', 1],
    ])
    expect(result.commitCount).toBe(2)
  })

  it('keeps the full month span while filtering counts by name and email identity', () => {
    const ada = commit('a', timestamp(2026, 1, 10))
    const otherAda = commit('b', timestamp(2026, 2, 10), 'Ada', 'work@example.com')
    const bob = commit('c', timestamp(2026, 3, 10), 'Bob', 'bob@example.com')

    const result = buildTimeline([ada, otherAda, bob], 'month', authorKey(otherAda))

    expect(result.authors).toHaveLength(3)
    expect(result.buckets.map((bucket) => [bucket.key, bucket.total])).toEqual([
      ['2026-01', 0],
      ['2026-02', 1],
      ['2026-03', 0],
    ])
    expect(result.commitCount).toBe(1)
  })

  it('groups commits into year buckets', () => {
    const result = buildTimeline(
      [commit('a', timestamp(2024, 6, 1)), commit('b', timestamp(2026, 6, 1))],
      'year',
    )

    expect(result.buckets.map((bucket) => [bucket.key, bucket.total])).toEqual([
      ['2024', 1],
      ['2025', 0],
      ['2026', 1],
    ])
  })
})

describe('filterCommitsByRange', () => {
  it('uses an inclusive start and exclusive end and removes synthetic rows', () => {
    const start = timestamp(2026, 4, 1, 0)
    const end = timestamp(2026, 4, 2, 0)
    const commits = [
      commit('before', start - 1),
      commit('start', start),
      commit('inside', end - 1),
      commit('end', end),
      { ...commit('stash', start), stashSelector: 'stash@{0}' },
    ]

    expect(
      filterCommitsByRange(commits, { start, end, label: '2026-04-01' }).map((item) => item.hash),
    ).toEqual(['start', 'inside'])
    expect(filterCommitsByRange(commits, null)).toBe(commits)
  })
})
