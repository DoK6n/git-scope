import { describe, expect, it } from 'vitest'
import { loadToken } from './auth'

describe('loadToken', () => {
  it('파일이 없으면 null', () => {
    expect(loadToken('/nonexistent')).toBeNull()
  })
})
