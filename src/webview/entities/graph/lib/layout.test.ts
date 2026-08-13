import { describe, expect, it } from 'vitest'
import type { Commit } from '@shared-types/domain'
import { layoutGraph } from './layout'

function commit(hash: string, parents: string[]): Commit {
  return {
    hash,
    parents,
    author: 'a',
    authorEmail: 'a@x',
    authorDate: 0,
    commitDate: 0,
    subject: hash,
  }
}

describe('layoutGraph', () => {
  it('선형 히스토리는 레인 0에 일렬로 놓인다', () => {
    const layout = layoutGraph(
      [commit('c', ['b']), commit('b', ['a']), commit('a', [])],
      false,
    )
    expect(layout.rows.map((r) => r.lane)).toEqual([0, 0, 0])
    expect(layout.laneCount).toBe(1)
    // c→b, b→a 두 개의 수직 선분
    expect(layout.segments).toEqual([
      { row: 0, fromLane: 0, toLane: 0, color: 0 },
      { row: 1, fromLane: 0, toLane: 0, color: 0 },
    ])
  })

  it('브랜치 분기·병합: merge 커밋의 2번째 부모가 새 레인을 얻고 분기점에서 수렴한다', () => {
    // m(merge) → f(feature), d(main) → base
    //   m: parents [d, f]
    //   f: parents [base]
    //   d: parents [base]
    //   base: root
    const layout = layoutGraph(
      [
        commit('m', ['d', 'f']),
        commit('f', ['base']),
        commit('d', ['base']),
        commit('base', []),
      ],
      false,
    )
    const [m, f, d, base] = layout.rows
    expect(m!.lane).toBe(0)
    expect(f!.lane).toBe(1) // 2번째 부모 → 새 레인
    expect(d!.lane).toBe(0) // 1번째 부모 → 같은 레인
    expect(base!.lane).toBe(0)
    expect(layout.laneCount).toBe(2)

    // m에서 f로 가는 분기 선분 (레인 0 → 레인 1)
    expect(layout.segments).toContainEqual({ row: 0, fromLane: 0, toLane: 1, color: 1 })
    // f의 레인이 base로 수렴 (레인 1 → 레인 0)
    expect(layout.segments).toContainEqual({ row: 2, fromLane: 1, toLane: 0, color: 1 })
  })

  it('독립 브랜치 tip은 새 레인을 얻는다', () => {
    // 서로 부모가 다른 두 tip
    const layout = layoutGraph(
      [commit('x', ['a']), commit('y', ['b']), commit('a', []), commit('b', [])],
      false,
    )
    expect(layout.rows[0]!.lane).toBe(0)
    expect(layout.rows[1]!.lane).toBe(1)
    expect(layout.rows[2]!.lane).toBe(0)
    expect(layout.rows[3]!.lane).toBe(1)
    // 두 라인은 색이 다르다
    expect(layout.rows[0]!.color).not.toBe(layout.rows[1]!.color)
  })

  it('hasMore면 마지막 행 아래로 이어지는 선분을 만든다', () => {
    const layout = layoutGraph([commit('c', ['b']), commit('b', ['a'])], true)
    expect(layout.segments).toContainEqual({ row: 1, fromLane: 0, toLane: 0, color: 0 })
  })

  it('레인이 해제되면 재사용된다', () => {
    // y(tip, lane1)가 a에서 main으로 합류해 lane1 해제 → 이후 새 tip z가 lane1 재사용
    const layout = layoutGraph(
      [
        commit('x', ['a']),
        commit('y', ['a']),
        commit('a', ['base']),
        commit('z', ['w']),
        commit('base', ['w']),
        commit('w', []),
      ],
      false,
    )
    expect(layout.rows[3]!.lane).toBe(1) // z가 해제된 레인 1 재사용
  })

  it('uncommitted 합성 노드(부모=HEAD)가 HEAD 레인으로 수렴한다', () => {
    const layout = layoutGraph(
      [
        { ...commit('*', ['head1']), isUncommitted: true },
        commit('other', ['head1']),
        commit('head1', []),
      ],
      false,
    )
    // '*'와 other 모두 head1을 기대 → head1 행에서 수렴
    expect(layout.segments).toContainEqual({
      row: 1,
      fromLane: layout.rows[0]!.lane,
      toLane: layout.rows[2]!.lane,
      color: layout.rows[0]!.color,
    })
  })
})
