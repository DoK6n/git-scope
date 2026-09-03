import { graphStore } from '../../../entities/graph'
import { request } from '../../../shared/api'
import { t } from '../../../shared/lib'

/** 현재 브랜치가 설정한 upstream·pull 전략을 그대로 사용해 pull한다. */
export async function pullCurrent(): Promise<boolean> {
  const repo = graphStore.currentRepo()
  const upstream = graphStore.graph()?.headUpstream
  if (!repo || !upstream) return false
  return graphStore.runAction(
    request('pullCurrent', { repo }),
    t('Pulled current branch from {0}', `${upstream.remote}/${upstream.branch}`),
    undefined,
    true,
  )
}
