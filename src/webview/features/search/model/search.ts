import { createMemo, createSignal } from 'solid-js'
import { graphStore } from '../../../entities/graph'

/**
 * 커밋 검색 상태. 기본은 대소문자를 구분하지 않는 부분 문자열 검색이며,
 * Match Case / Whole Word / Regular Expression 옵션을 지원한다.
 * 대상: 커밋 메시지 제목, 작성자, 해시.
 */
const [query, setQuery] = createSignal('')
const [currentPos, setCurrentPos] = createSignal(0)
const [caseSensitive, setCaseSensitive] = createSignal(false)
const [wholeWord, setWholeWord] = createSignal(false)
const [useRegex, setUseRegex] = createSignal(false)
/** GraphView가 소비하는 스크롤 타겟 행 (소비 후 null로 되돌린다) */
const [scrollTarget, setScrollTarget] = createSignal<number | null>(null)

function textMatcher(value: string): ((text: string) => boolean) | null {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  let source = useRegex() ? value : escaped
  if (wholeWord()) source = `(?<![\\p{L}\\p{N}_])(?:${source})(?![\\p{L}\\p{N}_])`
  try {
    const expression = new RegExp(source, caseSensitive() ? 'u' : 'iu')
    return (text) => expression.test(text)
  } catch {
    return null
  }
}

/** 일치하는 커밋의 행 인덱스 목록 */
const matchRows = createMemo<number[]>(() => {
  const q = query().trim()
  if (q === '') return []
  const commits = graphStore.graph()?.commits ?? []
  const matches = textMatcher(q)
  if (matches === null) return []
  const rows: number[] = []
  for (let i = 0; i < commits.length; i++) {
    const c = commits[i]!
    if (c.isUncommitted) continue
    if (matches(c.subject) || matches(c.author) || matches(c.hash)) {
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

/** UI에 표시할 1-based 현재 결과 번호. 결과가 없으면 0. */
const currentMatchNumber = createMemo(() => {
  const count = matchRows().length
  return count === 0 ? 0 : Math.min(currentPos(), count - 1) + 1
})

function search(value: string): void {
  setQuery(value)
  setCurrentPos(0)
  const rows = matchRows()
  if (rows.length > 0) setScrollTarget(rows[0]!)
}

function toggleOption(setter: (value: boolean) => void, value: boolean): void {
  setter(!value)
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
  caseSensitive,
  toggleCaseSensitive: () => toggleOption(setCaseSensitive, caseSensitive()),
  wholeWord,
  toggleWholeWord: () => toggleOption(setWholeWord, wholeWord()),
  useRegex,
  toggleRegex: () => toggleOption(setUseRegex, useRegex()),
  matchRows,
  matchSet,
  currentRow,
  currentMatchNumber,
  next: () => move(1),
  prev: () => move(-1),
  scrollTarget,
  consumeScrollTarget: () => setScrollTarget(null),
}
