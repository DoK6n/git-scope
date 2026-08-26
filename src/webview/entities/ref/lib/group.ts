import type { GitRef } from '@shared-types/domain'

/** 하나의 뱃지로 렌더링되는 단위 — 로컬 브랜치 + 같은 커밋의 대응 원격들 */
export interface RefGroup {
  ref: GitRef
  /** ref가 로컬 브랜치일 때, 같은 커밋을 가리키는 같은 이름의 원격 브랜치들 */
  remotes: GitRef[]
}

function strippedName(ref: GitRef): string {
  return ref.remote ? ref.name.slice(ref.remote.length + 1) : ref.name
}

/** origin/HEAD 같은 원격 심볼릭 HEAD 참조 — 뱃지로는 표시하되 checkout/삭제 대상은 아니다 */
export function isRemoteHeadRef(ref: GitRef): boolean {
  return ref.type === 'remote' && ref.remote !== undefined && ref.name === `${ref.remote}/HEAD`
}

/**
 * 같은 커밋의 로컬 브랜치와 이름이 대응하는 원격 브랜치를 한 뱃지로 합친다.
 * (예: main + origin/main → "main | origin") 대응이 없는 원격은 단독 뱃지.
 */
export function groupRefs(refs: GitRef[]): RefGroup[] {
  const groups: RefGroup[] = []
  const usedRemotes = new Set<GitRef>()

  for (const ref of refs) {
    if (ref.type !== 'head') continue
    const remotes = refs.filter(
      (r) => r.type === 'remote' && strippedName(r) === ref.name,
    )
    for (const r of remotes) usedRemotes.add(r)
    groups.push({ ref, remotes })
  }
  for (const ref of refs) {
    if (ref.type === 'remote' && !usedRemotes.has(ref)) groups.push({ ref, remotes: [] })
  }
  for (const ref of refs) {
    if (ref.type === 'tag') groups.push({ ref, remotes: [] })
  }
  return groups
}
