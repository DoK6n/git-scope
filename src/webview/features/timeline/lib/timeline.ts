import type { Commit } from '@shared-types/domain'

export type TimelineUnit = 'day' | 'month' | 'year'

export interface TimelineAuthor {
  key: string
  name: string
  email: string
}

export interface TimelineBucket {
  key: string
  start: number
  end: number
  total: number
  counts: Record<string, number>
}

export interface TimelineData {
  authors: TimelineAuthor[]
  buckets: TimelineBucket[]
  commitCount: number
}

export interface TimelineRange {
  start: number
  end: number
  label: string
}

export function authorKey(commit: Pick<Commit, 'author' | 'authorEmail'>): string {
  return JSON.stringify([commit.author, commit.authorEmail])
}

function isTimelineCommit(commit: Commit): boolean {
  return !commit.isUncommitted && commit.stashSelector === undefined && Number.isFinite(commit.authorDate)
}

function bucketStart(timestamp: number, unit: TimelineUnit): Date {
  const date = new Date(timestamp * 1000)
  if (unit === 'day') return new Date(date.getFullYear(), date.getMonth(), date.getDate())
  if (unit === 'month') return new Date(date.getFullYear(), date.getMonth(), 1)
  return new Date(date.getFullYear(), 0, 1)
}

function nextBucket(date: Date, unit: TimelineUnit): Date {
  if (unit === 'day') return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
  if (unit === 'month') return new Date(date.getFullYear(), date.getMonth() + 1, 1)
  return new Date(date.getFullYear() + 1, 0, 1)
}

function bucketKey(date: Date, unit: TimelineUnit): string {
  const year = date.getFullYear()
  if (unit === 'year') return String(year)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  if (unit === 'month') return `${year}-${month}`
  return `${year}-${month}-${String(date.getDate()).padStart(2, '0')}`
}

/**
 * Build continuous local-time buckets for the currently loaded commit set.
 * The bucket span stays stable when an author is selected; only the counts change.
 */
export function buildTimeline(
  commits: Commit[],
  unit: TimelineUnit,
  selectedAuthor: string | null = null,
): TimelineData {
  const eligible = commits.filter(isTimelineCommit)
  const authorMap = new Map<string, TimelineAuthor>()
  for (const commit of eligible) {
    const key = authorKey(commit)
    if (!authorMap.has(key)) {
      authorMap.set(key, { key, name: commit.author, email: commit.authorEmail })
    }
  }
  const authors = [...authorMap.values()].sort(
    (a, b) => a.name.localeCompare(b.name) || a.email.localeCompare(b.email),
  )
  if (eligible.length === 0) return { authors, buckets: [], commitCount: 0 }

  const first = bucketStart(Math.min(...eligible.map((commit) => commit.authorDate)), unit)
  const last = bucketStart(Math.max(...eligible.map((commit) => commit.authorDate)), unit)
  const buckets: TimelineBucket[] = []
  const byKey = new Map<string, TimelineBucket>()

  for (let cursor = first; cursor.getTime() <= last.getTime(); cursor = nextBucket(cursor, unit)) {
    const next = nextBucket(cursor, unit)
    const bucket: TimelineBucket = {
      key: bucketKey(cursor, unit),
      start: cursor.getTime() / 1000,
      end: next.getTime() / 1000,
      total: 0,
      counts: {},
    }
    buckets.push(bucket)
    byKey.set(bucket.key, bucket)
  }

  let commitCount = 0
  for (const commit of eligible) {
    const key = authorKey(commit)
    if (selectedAuthor !== null && selectedAuthor !== key) continue
    const bucket = byKey.get(bucketKey(bucketStart(commit.authorDate, unit), unit))
    if (!bucket) continue
    bucket.total++
    bucket.counts[key] = (bucket.counts[key] ?? 0) + 1
    commitCount++
  }

  return { authors, buckets, commitCount }
}

export function filterCommitsByRange(commits: Commit[], range: TimelineRange | null): Commit[] {
  if (range === null) return commits
  return commits.filter(
    (commit) =>
      isTimelineCommit(commit) && commit.authorDate >= range.start && commit.authorDate < range.end,
  )
}
