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
})
