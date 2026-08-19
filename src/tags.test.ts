import { describe, expect, it } from 'vitest'
import { parseTags } from './tags'

describe('parseTags', () => {
  it('태그가 없으면 원문 유지', () => {
    expect(parseTags('그냥 할 일')).toEqual({ title: '그냥 할 일', tags: [] })
  })
  it('여러 태그 추출', () => {
    expect(parseTags('장보기 #집 #급함').tags).toEqual(['집', '급함'])
  })
})
