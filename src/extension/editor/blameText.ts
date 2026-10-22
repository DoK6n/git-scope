import type { BlameCommit } from '../git/blame'

export type BlameLanguage = 'en' | 'ko'

/** 인라인 표시에서 커밋 요약을 자르는 길이 */
const SUMMARY_MAX = 60

const UNITS: { seconds: number; en: string; ko: string }[] = [
  { seconds: 365 * 24 * 3600, en: 'year', ko: '년' },
  { seconds: 30 * 24 * 3600, en: 'month', ko: '개월' },
  { seconds: 7 * 24 * 3600, en: 'week', ko: '주' },
  { seconds: 24 * 3600, en: 'day', ko: '일' },
  { seconds: 3600, en: 'hour', ko: '시간' },
  { seconds: 60, en: 'minute', ko: '분' },
]

/** epoch 초를 '3 days ago' / '3일 전' 형태로 바꾼다 */
export function relativeTime(epochSeconds: number, nowMs: number, lang: BlameLanguage): string {
  const elapsed = Math.max(0, Math.floor(nowMs / 1000) - epochSeconds)
  for (const unit of UNITS) {
    const count = Math.floor(elapsed / unit.seconds)
    if (count < 1) continue
    if (lang === 'ko') return `${count}${unit.ko} 전`
    return `${count} ${unit.en}${count === 1 ? '' : 's'} ago`
  }
  return lang === 'ko' ? '방금 전' : 'just now'
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

/** 줄 끝에 붙는 한 줄 요약: 작성자, 상대 시각 • 커밋 요약 */
export function inlineBlameText(commit: BlameCommit, nowMs: number, lang: BlameLanguage): string {
  if (commit.uncommitted) return lang === 'ko' ? '커밋되지 않은 변경' : 'Uncommitted changes'
  const when = relativeTime(commit.authorTime, nowMs, lang)
  return `${commit.author}, ${when} • ${truncate(commit.summary, SUMMARY_MAX)}`
}
