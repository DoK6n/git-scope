import { describe, expect, it } from 'vitest'
import type { Commit, GitRef } from '@shared-types/domain'
import { computeDragResetPlan } from './dragPlan'

function commit(hash: string, parents: string[], extra?: Partial<Commit>): Commit {
  return {
    hash,
    parents,
    author: 'a',
    authorEmail: 'a@x',
    authorDate: 0,
    commitDate: 0,
    subject: `subject ${hash}`,
    ...extra,
  }
}

function ref(name: string, hash: string, type: GitRef['type'] = 'head'): GitRef {
  return { name, hash, type, ...(type === 'remote' ? { remote: name.split('/')[0] } : {}) }
}

describe('computeDragResetPlan', () => {
  // 선형 히스토리: H1(HEAD) → H2 → H3 → H4
  const linear = [
    commit('H1', ['H2']),
    commit('H2', ['H3']),
    commit('H3', ['H4']),
    commit('H4', []),
  ]
  const linearRefs = [ref('main', 'H1'), ref('origin/main', 'H3', 'remote')]

  it('커서가 HEAD 행 이하면 지울 것이 없다', () => {
    expect(computeDragResetPlan(linear, linearRefs, 'H1', 'main', 0)).toBeNull()
  })

  it('커서 행 아래의 첫 체인 커밋이 새 HEAD, 그 위가 erased', () => {
    const plan = computeDragResetPlan(linear, linearRefs, 'H1', 'main', 2)!
    expect(plan.erased.map((c) => c.hash)).toEqual(['H1', 'H2'])
    expect(plan.target.hash).toBe('H3')
    expect([...plan.dimmed].sort()).toEqual(['H1', 'H2'])
  })

  it('커서가 로드 범위를 넘으면 로드된 체인 끝에서 멈춘다', () => {
    const plan = computeDragResetPlan(linear, linearRefs, 'H1', 'main', 999)!
    expect(plan.target.hash).toBe('H4')
    expect(plan.erased.map((c) => c.hash)).toEqual(['H1', 'H2', 'H3'])
  })

  it('HEAD가 root뿐이면(체인 길이 1) reset 불가', () => {
    expect(computeDragResetPlan([commit('R', [])], [ref('main', 'R')], 'R', 'main', 5)).toBeNull()
  })

  it('합성 uncommitted 노드는 행 계산·체인에서 제외된다', () => {
    const rows = [commit('WIP', ['H1'], { isUncommitted: true }), ...linear]
    // 커서 행 2 = H2의 행 (uncommitted가 행 0을 차지해 전체가 한 행씩 밀린다)
    const plan = computeDragResetPlan(rows, linearRefs, 'H1', 'main', 2)!
    expect(plan.erased.map((c) => c.hash)).toEqual(['H1'])
    expect(plan.target.hash).toBe('H2')
    expect(plan.dimmed.has('WIP')).toBe(false)
  })

  // 머지 히스토리: M(HEAD, merge of A+S) / S(side) / A / B
  const merged = [
    commit('M', ['A', 'S']),
    commit('S', ['A']),
    commit('A', ['B']),
    commit('B', []),
  ]

  it('머지 커밋을 지우면 그 머지로만 도달 가능하던 사이드 커밋도 dim된다', () => {
    const plan = computeDragResetPlan(merged, [ref('main', 'M')], 'M', 'main', 2)!
    expect(plan.erased.map((c) => c.hash)).toEqual(['M'])
    expect(plan.target.hash).toBe('A')
    expect([...plan.dimmed].sort()).toEqual(['M', 'S'])
  })

  it('사이드 커밋이 다른 ref로 보호되면 dim에서 제외된다 (그래프에 남는다)', () => {
    const refs = [ref('main', 'M'), ref('side', 'S')]
    const plan = computeDragResetPlan(merged, refs, 'M', 'main', 2)!
    expect([...plan.dimmed]).toEqual(['M'])
  })

  it('erased 자신은 다른 ref가 보호해도 dim된다 — 브랜치에서는 제거되므로', () => {
    // origin/main이 HEAD와 같은 커밋을 가리켜도 로컬 브랜치에서는 사라진다
    const refs = [ref('main', 'H1'), ref('origin/main', 'H1', 'remote')]
    const plan = computeDragResetPlan(linear, refs, 'H1', 'main', 1)!
    expect([...plan.dimmed]).toEqual(['H1'])
  })

  it('detached HEAD(headBranch null)면 모든 ref가 보호자다', () => {
    const plan = computeDragResetPlan(merged, [ref('main', 'M')], 'M', null, 2)!
    // main@M이 보호하므로 사이드 S는 남고, erased인 M만 dim
    expect([...plan.dimmed]).toEqual(['M'])
  })

  it('HEAD가 로드 범위에 없으면 null', () => {
    expect(computeDragResetPlan(linear, linearRefs, 'ZZZ', 'main', 2)).toBeNull()
    expect(computeDragResetPlan(linear, linearRefs, null, 'main', 2)).toBeNull()
  })
})
