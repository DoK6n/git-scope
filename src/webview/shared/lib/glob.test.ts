import { describe, expect, it } from 'vitest'
import { globToRegExp, isGlobPattern, makeMatcher } from './glob'

describe('isGlobPattern', () => {
  it('메타문자를 감지한다', () => {
    expect(isGlobPattern('feature/*')).toBe(true)
    expect(isGlobPattern('fix-?')).toBe(true)
    expect(isGlobPattern('release-[0-9]')).toBe(true)
    expect(isGlobPattern('plain-text')).toBe(false)
  })
})

describe('globToRegExp', () => {
  it('*는 임의 문자열과 매칭 (경로 구분 없음)', () => {
    const re = globToRegExp('feature/*')!
    expect(re.test('feature/graph')).toBe(true)
    expect(re.test('feature/a/b')).toBe(true) // *는 /도 매칭
    expect(re.test('main')).toBe(false)
    expect(re.test('x-feature/graph')).toBe(false) // 앵커됨
  })

  it('?는 한 문자', () => {
    const re = globToRegExp('v1.?')!
    expect(re.test('v1.0')).toBe(true)
    expect(re.test('v1.10')).toBe(false)
    expect(re.test('v1x0')).toBe(false) // .은 리터럴로 이스케이프
  })

  it('[...] 문자 클래스와 [!...] 부정', () => {
    expect(globToRegExp('release-[0-9]')!.test('release-3')).toBe(true)
    expect(globToRegExp('release-[0-9]')!.test('release-x')).toBe(false)
    expect(globToRegExp('release-[!0-9]')!.test('release-x')).toBe(true)
    expect(globToRegExp('release-[!0-9]')!.test('release-3')).toBe(false)
  })

  it('대소문자를 무시한다', () => {
    expect(globToRegExp('Feature/*')!.test('feature/x')).toBe(true)
  })

  it('닫히지 않은 [는 null (폴백용)', () => {
    expect(globToRegExp('broken[')).toBeNull()
  })

  it('정규식 특수문자를 리터럴 취급', () => {
    expect(globToRegExp('fix(a)+b*')!.test('fix(a)+bXY')).toBe(true)
    expect(globToRegExp('a|b')!.test('a')).toBe(false)
    expect(globToRegExp('a|b')!.test('a|b')).toBe(true)
  })
})

describe('makeMatcher', () => {
  it('glob 입력이면 앵커된 glob 매칭', () => {
    const matches = makeMatcher('feature/*')
    expect(matches('feature/graph')).toBe(true)
    expect(matches('my-feature/graph')).toBe(false)
  })

  it('일반 입력이면 대소문자 무시 부분 문자열 매칭', () => {
    const matches = makeMatcher('Graph')
    expect(matches('feat: add graph view')).toBe(true)
    expect(matches('fix: parser')).toBe(false)
  })

  it('유효하지 않은 glob은 부분 문자열 매칭으로 폴백', () => {
    const matches = makeMatcher('broken[')
    expect(matches('this is broken[ text')).toBe(true)
  })
})
