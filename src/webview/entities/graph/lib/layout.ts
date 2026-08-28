import type { Commit } from '@shared-types/domain'

export interface RowLayout {
  /** 노드가 위치하는 레인 인덱스 */
  lane: number
  /** 색상 인덱스 (팔레트 mod로 사용) */
  color: number
}

/** row → row+1 구간을 잇는 선분. fromLane은 row에서의, toLane은 row+1에서의 x 위치 */
export interface Segment {
  row: number
  fromLane: number
  toLane: number
  color: number
  /**
   * 이 선분이 나르는 엣지의 자식(출발) 커밋 행.
   * 자식→부모 엣지가 다른 브랜치 행들을 통과하며 여러 선분으로 쪼개져도
   * 모두 같은 childRow를 갖는다 — reset 미리보기에서 엣지 단위 dim 판정에 쓴다
   */
  childRow: number
}

export interface GraphLayout {
  /** commits와 같은 인덱스 */
  rows: RowLayout[]
  segments: Segment[]
  laneCount: number
}

interface Lane {
  /** 이 레인이 다음에 만날 것으로 기대하는 커밋 해시 */
  expects: string
  color: number
  /** 현재 나르는 엣지의 자식 커밋 행 — 첫 선분 방출 전(방금 태어난 tip)에만 undefined */
  childRow?: number
  /** 이 행에서 새로 생긴 레인 — 위쪽 구간 없음(브랜치 tip) 또는 노드에서 분기(부모 레인) */
  bornRow?: number
  /** 분기 출발 레인 (merge 커밋의 2번째 이후 부모) */
  bornFrom?: number
  /** 기존 레인에 merge 엣지가 합류: {row, fromLane} */
  joinFrom?: { row: number; fromLane: number }
}

/**
 * 커밋 목록(시간 역순, --date-order)에 레인을 배치한다.
 *
 * 각 레인은 "다음에 나타날 커밋 해시"를 기대하며 아래로 흐른다.
 * - 커밋의 노드 레인 = 그 해시를 기대하던 첫 레인 (없으면 새 레인 = 브랜치 tip)
 * - 같은 해시를 기대하던 다른 레인들은 노드로 수렴하고 해제된다
 * - 노드 레인은 첫 부모를 계속 기대하고, 나머지 부모는 새 레인으로 분기하거나
 *   이미 그 부모를 기대하는 레인에 합류한다
 */
export function layoutGraph(commits: Commit[], hasMore: boolean): GraphLayout {
  const lanes: (Lane | null)[] = []
  const rows: RowLayout[] = []
  const segments: Segment[] = []
  let colorCounter = 0
  let laneCount = 0

  const firstFree = (): number => {
    const idx = lanes.findIndex((l) => l === null)
    if (idx >= 0) return idx
    lanes.push(null)
    return lanes.length - 1
  }

  for (let i = 0; i < commits.length; i++) {
    const commit = commits[i]!

    // 1. 노드 레인 결정
    let nodeLane = lanes.findIndex((l) => l !== null && l.expects === commit.hash)
    if (nodeLane === -1) {
      nodeLane = firstFree()
      lanes[nodeLane] = { expects: commit.hash, color: colorCounter++, bornRow: i }
    }
    const node = lanes[nodeLane]!
    rows.push({ lane: nodeLane, color: node.color })

    // 2. 위쪽 구간(i-1 → i)의 선분 방출 — 이 행에서 태어난 tip 레인은 제외
    if (i > 0) {
      for (let j = 0; j < lanes.length; j++) {
        const lane = lanes[j]
        if (!lane) continue
        if (lane.bornRow === i) continue
        const from =
          lane.bornRow === i - 1 && lane.bornFrom !== undefined ? lane.bornFrom : j
        const to = lane.expects === commit.hash ? nodeLane : j
        // 방출 시점의 레인은 항상 어떤 자식에서 출발한 엣지를 나르고 있다
        segments.push({ row: i - 1, fromLane: from, toLane: to, color: lane.color, childRow: lane.childRow! })
        // merge 엣지 합류: 노드에서 이 레인으로 내려오는 추가 선분 — 자식은 merge 커밋
        if (lane.joinFrom && lane.joinFrom.row === i - 1) {
          segments.push({ row: i - 1, fromLane: lane.joinFrom.fromLane, toLane: to, color: lane.color, childRow: lane.joinFrom.row })
        }
        lane.joinFrom = undefined
        if (lane.bornRow === i - 1) {
          lane.bornRow = undefined
          lane.bornFrom = undefined
        }
      }
    }

    // 3. 레인 상태 갱신 (i → i+1 구간)
    for (let j = 0; j < lanes.length; j++) {
      if (j !== nodeLane && lanes[j] !== null && lanes[j]!.expects === commit.hash) {
        lanes[j] = null
      }
    }
    const parents = commit.parents
    if (parents.length === 0) {
      lanes[nodeLane] = null
    } else {
      node.expects = parents[0]!
      node.childRow = i
      for (let p = 1; p < parents.length; p++) {
        const parentHash = parents[p]!
        const existing = lanes.findIndex(
          (l, idx) => idx !== nodeLane && l !== null && l.expects === parentHash,
        )
        if (existing >= 0) {
          lanes[existing]!.joinFrom = { row: i, fromLane: nodeLane }
        } else {
          const idx = firstFree()
          lanes[idx] = {
            expects: parentHash,
            color: colorCounter++,
            childRow: i,
            bornRow: i,
            bornFrom: nodeLane,
          }
        }
      }
    }

    laneCount = Math.max(laneCount, lanes.length)
  }

  // 마지막 행 아래로 이어지는 선 (더 로드할 커밋이 남은 경우)
  if (hasMore && commits.length > 0) {
    const lastRow = commits.length - 1
    for (let j = 0; j < lanes.length; j++) {
      const lane = lanes[j]
      if (!lane) continue
      const from =
        lane.bornRow === lastRow && lane.bornFrom !== undefined ? lane.bornFrom : j
      segments.push({ row: lastRow, fromLane: from, toLane: j, color: lane.color, childRow: lane.childRow! })
      if (lane.joinFrom && lane.joinFrom.row === lastRow) {
        segments.push({ row: lastRow, fromLane: lane.joinFrom.fromLane, toLane: j, color: lane.color, childRow: lane.joinFrom.row })
      }
    }
  }

  return { rows, segments, laneCount }
}
