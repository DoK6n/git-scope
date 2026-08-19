import type { Commit } from '@shared-types/domain'
import { graphStore } from '../../../entities/graph'
import { request } from '../../../shared/api'
import { confirmDialog, formDialog } from '../../../shared/ui'

function repo(): string | null {
  return graphStore.currentRepo()
}

/** cherry-pick — merge 커밋이면 첫 부모(-m 1) 기준 */
export async function cherryPick(commit: Commit): Promise<void> {
  const r = repo()
  if (!r) return
  const values = await formDialog({
    title: `Cherry Pick ${commit.hash.slice(0, 8)}`,
    note: commit.subject,
    fields: [
      { kind: 'checkbox', name: 'recordOrigin', label: '원본 커밋 표기 (-x)', initial: false },
      { kind: 'checkbox', name: 'noCommit', label: '커밋하지 않고 변경만 적용 (--no-commit)', initial: false },
    ],
    confirmLabel: 'Cherry Pick',
  })
  if (!values) return
  await graphStore.runAction(
    request('cherryPick', {
      repo: r,
      hash: commit.hash,
      noCommit: Boolean(values.noCommit),
      recordOrigin: Boolean(values.recordOrigin),
      isMerge: commit.parents.length > 1,
    }),
    `cherry-pick ${commit.hash.slice(0, 8)} 완료`,
  )
}

/** revert — 되돌리는 새 커밋 생성 */
export async function revertCommit(commit: Commit): Promise<void> {
  const r = repo()
  if (!r) return
  const ok = await confirmDialog({
    title: `Revert ${commit.hash.slice(0, 8)}`,
    message: `"${commit.subject}"\n\n이 커밋의 변경을 되돌리는 새 커밋을 만듭니다.`,
    confirmLabel: 'Revert',
  })
  if (!ok) return
  await graphStore.runAction(
    request('revert', { repo: r, hash: commit.hash, isMerge: commit.parents.length > 1 }),
    `revert ${commit.hash.slice(0, 8)} 완료`,
  )
}

/** drop — 커밋을 히스토리에서 제거 ⚠️ */
export async function dropCommit(commit: Commit): Promise<void> {
  const r = repo()
  if (!r) return
  const ok = await confirmDialog({
    title: `Drop Commit ${commit.hash.slice(0, 8)}`,
    message: `"${commit.subject}"\n\n이 커밋을 현재 브랜치 히스토리에서 제거합니다(rebase). 이후 커밋들의 해시가 바뀝니다.`,
    confirmLabel: 'Drop',
    danger: true,
  })
  if (!ok) return
  await graphStore.runAction(
    request('dropCommit', { repo: r, hash: commit.hash }),
    `drop ${commit.hash.slice(0, 8)} 완료`,
  )
}

/** 현재 브랜치를 대상 커밋/브랜치 위로 rebase */
export async function rebaseOnto(target: string, label: string): Promise<void> {
  const r = repo()
  if (!r) return
  const headBranch = graphStore.graph()?.headBranch ?? 'HEAD'
  const ok = await confirmDialog({
    title: `Rebase ${headBranch} on ${label}`,
    message: `${headBranch} 브랜치를 ${label} 위로 rebase 합니다. 커밋 해시가 바뀝니다.`,
    confirmLabel: 'Rebase',
    danger: true,
  })
  if (!ok) return
  await graphStore.runAction(
    request('rebase', { repo: r, target }),
    `rebase onto ${label} 완료`,
  )
}
