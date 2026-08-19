import { describe, expect, it } from 'vitest'
import type { GitRef } from '@shared-types/domain'
import { groupRefs } from './group'

const head = (name: string): GitRef => ({ name, hash: 'h', type: 'head' })
const remote = (name: string): GitRef => ({ name, hash: 'h', type: 'remote', remote: name.split('/')[0]! })
const tag = (name: string): GitRef => ({ name, hash: 'h', type: 'tag' })

describe('groupRefs', () => {
  it('같은 이름의 로컬+원격을 한 그룹으로 합친다', () => {
    const groups = groupRefs([head('main'), remote('origin/main')])
    expect(groups).toHaveLength(1)
    expect(groups[0]!.ref.name).toBe('main')
    expect(groups[0]!.remotes.map((r) => r.remote)).toEqual(['origin'])
  })

  it('대응 없는 원격은 단독 뱃지', () => {
    const groups = groupRefs([head('main'), remote('origin/feature/x')])
    expect(groups).toHaveLength(2)
    expect(groups[1]!.ref.name).toBe('origin/feature/x')
    expect(groups[1]!.remotes).toEqual([])
  })

  it('멀티 remote가 모두 합쳐진다', () => {
    const groups = groupRefs([head('main'), remote('origin/main'), remote('upstream/main')])
    expect(groups).toHaveLength(1)
    expect(groups[0]!.remotes.map((r) => r.remote)).toEqual(['origin', 'upstream'])
  })

  it('슬래시 포함 브랜치명도 정확히 대응한다', () => {
    const groups = groupRefs([head('openapi/MCP-238'), remote('origin/openapi/MCP-238')])
    expect(groups).toHaveLength(1)
    expect(groups[0]!.remotes.map((r) => r.remote)).toEqual(['origin'])
  })

  it('태그는 항상 단독', () => {
    const groups = groupRefs([head('main'), tag('v1.0.0')])
    expect(groups.map((g) => g.ref.name)).toEqual(['main', 'v1.0.0'])
  })
})
