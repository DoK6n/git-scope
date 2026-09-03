import { afterEach, describe, expect, it } from 'vitest'
import { setLocale, t } from './i18n'

afterEach(() => {
  setLocale('en')
})

describe('t', () => {
  it('기본(en)은 원문을 그대로 반환한다', () => {
    expect(t('Commit not found in the graph.')).toBe('Commit not found in the graph.')
  })

  it('ko면 사전 번역을 반환하고, 사전에 없으면 원문 폴백', () => {
    setLocale('ko')
    expect(t('Commit not found in the graph.')).toBe('해당 커밋을 그래프에서 찾을 수 없습니다.')
    expect(t('not-in-dictionary')).toBe('not-in-dictionary')
  })

  it('{N} 자리표시자를 인자로 치환한다 (같은 번호 반복 포함)', () => {
    expect(t('Branch {0} created (from {1})', 'feat/x', 'main')).toBe(
      'Branch feat/x created (from main)',
    )
    setLocale('ko')
    expect(t('Commit hashes of {0} will change and HEAD moves to {0}.', 'dev')).toBe(
      'dev의 커밋 해시가 바뀌고 HEAD가 dev으로 이동합니다.',
    )
  })

  it('타임라인 노출 문구와 개수를 번역한다', () => {
    setLocale('ko')
    expect(t('Commit Timeline')).toBe('커밋 타임라인')
    expect(t('{0} of {1} currently loaded commits', 2, 10)).toBe(
      '현재 로드된 커밋 10개 중 2개',
    )
    expect(t('Timeline period: {0}', '2026-09')).toBe('타임라인 기간: 2026-09')
    expect(t('Clear')).toBe('지우기')
  })

  it('Git 아이콘 툴바의 접근 가능한 이름을 한국어로 제공한다', () => {
    setLocale('ko')
    expect(t('Reset HEAD by N commits')).toBe('HEAD를 N개 커밋만큼 되돌리기')
    expect(t('Refresh graph')).toBe('그래프 새로고침')
    expect(t('Stashes')).toBe('스태시')
    expect(t('Worktrees')).toBe('워크트리')
  })

  it('체크아웃 없는 브랜치 pull 문구를 번역한다', () => {
    setLocale('ko')
    expect(t('Pull Branch…')).toBe('브랜치 Pull…')
    expect(t('Branch {0} has no upstream branch.', 'feat/local')).toBe(
      '브랜치 feat/local에 upstream 브랜치가 없습니다.',
    )
  })
})
