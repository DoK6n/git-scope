import { describe, expect, it } from 'vitest'
import type { Commit } from '@shared-types/domain'
import { findFixupTarget, fixupKind, fixupTargetSubject } from './fixup'

function commit(hash: string, subject: string, extra?: Partial<Commit>): Commit {
  return {
    hash,
    parents: [],
    author: 't',
    authorEmail: 't@t.t',
    authorDate: 0,
    commitDate: 0,
    subject,
    ...extra,
  }
}

describe('fixupKind', () => {
  it('fixup!/squash!/amend! 접두사를 판별한다', () => {
    expect(fixupKind('fixup! feat: a')).toBe('fixup')
    expect(fixupKind('squash! feat: a')).toBe('squash')
    expect(fixupKind('amend! feat: a')).toBe('amend')
    expect(fixupKind('feat: fixup 없는 커밋')).toBeNull()
    expect(fixupKind('fixup!붙어있음')).toBeNull() // 공백 없으면 아님
  })
})

describe('fixupTargetSubject', () => {
  it('중첩 접두사를 전부 벗긴다', () => {
    expect(fixupTargetSubject('fixup! feat: a')).toBe('feat: a')
    expect(fixupTargetSubject('fixup! fixup! feat: a')).toBe('feat: a')
    expect(fixupTargetSubject('squash! fixup! feat: a')).toBe('feat: a')
  })
})

describe('findFixupTarget', () => {
  it('fixup보다 오래된 커밋 중 제목이 정확히 일치하는 첫 커밋', () => {
    const commits = [
      commit('c3', 'fixup! feat: a'),
      commit('c2', 'chore: 다른 작업'),
      commit('c1', 'feat: a'),
      commit('c0', 'feat: a'), // 더 오래된 동일 제목 — 가장 가까운 c1이 우선
    ]
    expect(findFixupTarget(commits, 0)?.hash).toBe('c1')
  })

  it('정확 일치가 없으면 접두 일치로 폴백한다 (git autosquash 규칙)', () => {
    const commits = [commit('c2', 'fixup! feat: a'), commit('c1', 'feat: a — 상세 설명')]
    expect(findFixupTarget(commits, 0)?.hash).toBe('c1')
  })

  it('fixup보다 새로운 커밋·합성 행은 대상이 아니다', () => {
    const commits = [
      commit('newer', 'feat: a'),
      commit('c2', 'fixup! feat: a'),
      commit('*', 'feat: a', { isUncommitted: true }),
      commit('st', 'feat: a', { stashSelector: 'stash@{0}' }),
    ]
    expect(findFixupTarget(commits, 1)).toBeNull()
  })
})
