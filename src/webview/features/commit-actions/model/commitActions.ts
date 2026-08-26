import type { Commit } from '@shared-types/domain'
import { graphStore } from '../../../entities/graph'
import { request } from '../../../shared/api'
import { t } from '../../../shared/lib'
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
      { kind: 'checkbox', name: 'recordOrigin', label: t('Record origin commit (-x)'), initial: false },
      { kind: 'checkbox', name: 'noCommit', label: t('Apply changes without committing (--no-commit)'), initial: false },
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
    t('Cherry-picked {0}', commit.hash.slice(0, 8)),
  )
}

/** revert — 되돌리는 새 커밋 생성 */
export async function revertCommit(commit: Commit): Promise<void> {
  const r = repo()
  if (!r) return
  const ok = await confirmDialog({
    title: `Revert ${commit.hash.slice(0, 8)}`,
    message: t('"{0}"\n\nCreates a new commit that reverts the changes of this commit.', commit.subject),
    confirmLabel: 'Revert',
  })
  if (!ok) return
  await graphStore.runAction(
    request('revert', { repo: r, hash: commit.hash, isMerge: commit.parents.length > 1 }),
    t('Reverted {0}', commit.hash.slice(0, 8)),
  )
}

/** drop — 커밋을 히스토리에서 제거 ⚠️ */
export async function dropCommit(commit: Commit): Promise<void> {
  const r = repo()
  if (!r) return
  const ok = await confirmDialog({
    title: `Drop Commit ${commit.hash.slice(0, 8)}`,
    message: t('"{0}"\n\nRemoves this commit from the current branch history (rebase). Hashes of later commits will change.', commit.subject),
    confirmLabel: 'Drop',
    danger: true,
  })
  if (!ok) return
  await graphStore.runAction(
    request('dropCommit', { repo: r, hash: commit.hash }),
    t('Dropped {0}', commit.hash.slice(0, 8)),
  )
}

/** 커밋 메시지만 수정 (reword) — HEAD가 아니면 rebase 기반이라 이후 해시가 바뀐다 ⚠️ */
export async function rewordCommit(commit: Commit): Promise<void> {
  const r = repo()
  if (!r) return
  // 기존 메시지 전문(%B)을 가져와 textarea에 미리 채운다
  let original: string
  try {
    original = (await request('getCommitDetails', { repo: r, hash: commit.hash })).body
  } catch (e) {
    graphStore.setError(e instanceof Error ? e.message : String(e))
    return
  }
  const isHead = graphStore.graph()?.headHash === commit.hash
  const values = await formDialog({
    title: `Edit Commit Message ${commit.hash.slice(0, 8)}`,
    fields: [
      { kind: 'textarea', name: 'message', label: 'Commit message', initial: original, rows: 8 },
    ],
    confirmLabel: 'Save',
    warning: isHead
      ? undefined
      : () => t('Not the HEAD commit — history is rewritten via rebase, so hashes of later commits will change.'),
  })
  if (!values) return
  const message = String(values.message).trim()
  if (message === '') {
    graphStore.setError(t('Commit message is empty.'))
    return
  }
  if (message === original) return
  await graphStore.runAction(
    request('rewordCommit', { repo: r, hash: commit.hash, message }),
    t('Commit message updated ({0})', commit.hash.slice(0, 8)),
  )
}

/** 현재 브랜치를 대상 커밋/브랜치 위로 rebase */
export async function rebaseOnto(target: string, label: string): Promise<void> {
  const r = repo()
  if (!r) return
  const headBranch = graphStore.graph()?.headBranch ?? 'HEAD'
  const ok = await confirmDialog({
    title: `Rebase ${headBranch} on ${label}`,
    message: t('Rebases branch {0} onto {1}. Commit hashes will change.', headBranch, label),
    confirmLabel: 'Rebase',
    danger: true,
  })
  if (!ok) return
  await graphStore.runAction(
    request('rebase', { repo: r, target }),
    t('Rebased onto {0}', label),
  )
}
