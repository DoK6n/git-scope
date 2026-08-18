import { createMemo, createSignal } from 'solid-js'
import { graphStore } from '../../../entities/graph'
import { makeMatcher } from '../../../shared/lib'

/**
 * 커밋 검색 상태. glob 메타문자가 포함되면 glob 매칭(앵커),
 * 아니면 부분 문자열 매칭 (shared/lib/glob의 makeMatcher).
 * 대상: 커밋 메시지 제목, 작성자, 해시(접두사).
 */
const [query, setQuery] = createSignal('')
const [currentPos, setCurrentPos] = createSignal(0)
/** GraphView가 소비하는 스크롤 타겟 행 (소비 후 null로 되돌린다) */
const [scrollTarget, setScrollTarget] = createSignal<number | null>(null)

/** 일치하는 커밋의 행 인덱스 목록 */
const matchRows = createMemo<number[]>(() => {
  const q = query().trim()
  if (q === '') return []
  const commits = graphStore.graph()?.commits ?? []
  const matches = makeMatcher(q)
  const rows: number[] = []
  for (let i = 0; i < commits.length; i++) {
    const c = commits[i]!
    if (c.isUncommitted) continue
    if (matches(c.subject) || matches(c.author) || c.hash.startsWith(q.toLowerCase())) {
      rows.push(i)
    }
  }
  return rows
})

const matchSet = createMemo(() => new Set(matchRows()))

/** 현재 위치의 매치 행 (검색 결과가 바뀌면 범위 내로 보정) */
const currentRow = createMemo<number | null>(() => {
  const rows = matchRows()
  if (rows.length === 0) return null
  return rows[Math.min(currentPos(), rows.length - 1)]!
})

function search(value: string): void {
  setQuery(value)
  setCurrentPos(0)
  const rows = matchRows()
  if (rows.length > 0) setScrollTarget(rows[0]!)
}

function move(delta: 1 | -1): void {
  const rows = matchRows()
  if (rows.length === 0) return
  const next = (currentPos() + delta + rows.length) % rows.length
  setCurrentPos(next)
  setScrollTarget(rows[next]!)
}

export const searchStore = {
  query,
  search,
  matchRows,
  matchSet,
  currentRow,
  next: () => move(1),
  prev: () => move(-1),
  scrollTarget,
  consumeScrollTarget: () => setScrollTarget(null),
}
