import type { Commit, GitRef } from '@shared-types/domain'

/** drag-to-reset 미리보기 계산 결과 (스펙 60-new-features §10) */
export interface DragResetPlan {
  /** 브랜치에서 제거될 first-parent 체인 커밋 — HEAD부터 순서대로 */
  erased: Commit[]
  /** 새 HEAD가 될 커밋 (first-parent 체인상 커서 아래 첫 커밋) */
  target: Commit
  /**
   * 미리보기에서 흐리게 처리할 커밋 해시.
   * erased 전체 + "erased를 통해서만 도달 가능했던" 사이드 브랜치 커밋.
   * 다른 ref(원격·태그·타 브랜치)로 도달 가능한 사이드 커밋은 그래프에 남으므로 제외한다 —
   * 단 erased 자체는 브랜치에서 떨어져 나가는 대상이므로 항상 포함.
   */
  dimmed: Set<string>
}

/** startHashes에서 parents를 따라 도달 가능한 커밋 해시 집합 (로드된 범위 내) */
function reachable(startHashes: string[], byHash: Map<string, Commit>): Set<string> {
  const seen = new Set<string>()
  const queue = startHashes.filter((h) => byHash.has(h))
  while (queue.length > 0) {
    const hash = queue.pop()!
    if (seen.has(hash)) continue
    seen.add(hash)
    for (const parent of byHash.get(hash)!.parents) {
      if (byHash.has(parent) && !seen.has(parent)) queue.push(parent)
    }
  }
  return seen
}

/**
 * HEAD 점을 cursorRow까지 끌었을 때의 reset 미리보기를 계산한다.
 *
 * - erased = HEAD에서 first-parent 체인을 따라 내려가며 행 인덱스가 cursorRow보다 위인 커밋들
 * - target = 그 다음 체인 커밋 (= 마지막 erased의 첫 부모). 체인이 로드 범위를 벗어나면
 *   로드된 마지막 체인 커밋에서 멈춘다 (더 아래로는 못 끈다)
 * - 지울 것이 없으면(커서가 HEAD 행 이하, 또는 HEAD가 root뿐) null
 */
export function computeDragResetPlan(
  commits: Commit[],
  refs: GitRef[],
  headHash: string | null,
  headBranch: string | null,
  cursorRow: number,
): DragResetPlan | null {
  if (headHash === null) return null
  const byHash = new Map<string, Commit>()
  const rowOf = new Map<string, number>()
  for (let i = 0; i < commits.length; i++) {
    const c = commits[i]!
    // 합성 노드(uncommitted)는 체인·도달성 계산에서 제외한다
    if (c.isUncommitted) continue
    byHash.set(c.hash, c)
    rowOf.set(c.hash, i)
  }

  // HEAD부터 로드된 범위 내 first-parent 체인
  const chain: Commit[] = []
  let current = byHash.get(headHash)
  while (current) {
    chain.push(current)
    const parent = current.parents[0]
    current = parent !== undefined ? byHash.get(parent) : undefined
  }
  if (chain.length < 2) return null // root뿐이거나 HEAD가 로드 범위에 없음

  // 커서 행 아래(포함)의 첫 체인 커밋이 새 HEAD. 없으면 로드된 체인 끝에서 멈춘다
  let targetIdx = chain.findIndex((c) => rowOf.get(c.hash)! >= cursorRow)
  if (targetIdx < 0) targetIdx = chain.length - 1
  if (targetIdx === 0) return null // 커서가 HEAD 행 이상 — 지울 것 없음

  const erased = chain.slice(0, targetIdx)
  const target = chain[targetIdx]!

  // HEAD에서는 도달 가능하지만 target에서는 불가능해지는 집합 (erased + 사이드 브랜치)
  const fromHead = reachable([headHash], byHash)
  const fromTarget = reachable([target.hash], byHash)
  // 다른 ref가 보호하는 커밋은 reset 후에도 그래프에 남는다 — 사이드 dim에서 제외.
  // 이동 대상인 현재 브랜치 ref 자신은 보호자가 아니다
  const protectorHashes = refs
    .filter((r) => !(r.type === 'head' && headBranch !== null && r.name === headBranch))
    .map((r) => r.hash)
  const protectedSet = reachable(protectorHashes, byHash)

  const dimmed = new Set<string>(erased.map((c) => c.hash))
  for (const hash of fromHead) {
    if (!fromTarget.has(hash) && !protectedSet.has(hash)) dimmed.add(hash)
  }
  return { erased, target, dimmed }
}
