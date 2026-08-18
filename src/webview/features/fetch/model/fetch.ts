import { graphStore } from '../../../entities/graph'
import { request } from '../../../shared/api'

/**
 * 모든 원격에서 fetch. prune이면 원격에서 삭제된 브랜치 참조를 함께 정리한다.
 * 실행 후 그래프가 갱신되어 prune 된 라벨이 사라진다. (스펙 60-new-features §4)
 */
export async function fetchAll(prune: boolean): Promise<boolean> {
  const repo = graphStore.currentRepo()
  if (!repo) return false
  return graphStore.runAction(request('fetch', { repo, prune }))
}

/** 기본 fetch — 설정 gitScope.fetchPruneByDefault를 따른다 */
export async function fetchDefault(): Promise<boolean> {
  return fetchAll(graphStore.settings().fetchPruneByDefault)
}
