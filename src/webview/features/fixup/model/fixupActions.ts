import type { Commit } from '@shared-types/domain'
import { graphStore } from '../../../entities/graph'
import { request } from '../../../shared/api'
import { t } from '../../../shared/lib'
import { confirmDialog, formDialog } from '../../../shared/ui'
import { findFixupTarget, fixupTargetSubject } from '../lib/fixup'

/** 로드된 커밋에서 이 fixup 커밋의 대상을 찾는다 (없으면 안내 후 null) */
function resolveTarget(commit: Commit): Commit | null {
  const commits = graphStore.graph()?.commits ?? []
  const index = commits.findIndex((c) => c.hash === commit.hash)
  if (index < 0) return null
  const target = findFixupTarget(commits, index)
  if (!target) {
    graphStore.setNotice(
      t('Target commit ("{0}") not found in the loaded range — try loading more commits.', fixupTargetSubject(commit.subject)),
    )
  }
  return target
}

/** fixup 뱃지 클릭: 대상 커밋으로 스크롤 이동 */
export function scrollToFixupTarget(commit: Commit): void {
  const target = resolveTarget(commit)
  if (!target) return
  graphStore.setSelectedCommit(target.hash)
  void graphStore.scrollToHash(target.hash)
}

/** 커밋 우클릭: 현재 워킹트리 변경을 이 커밋용 fixup으로 커밋 */
export async function createFixupCommit(commit: Commit): Promise<void> {
  const repo = graphStore.currentRepo()
  if (!repo) return
  const values = await formDialog({
    title: `Create Fixup Commit for ${commit.hash.slice(0, 8)}`,
    note: t('fixup! {0}\n\nYou can squash it into the target later with "Squash Fixups… (autosquash)".', commit.subject),
    fields: [
      {
        kind: 'checkbox',
        name: 'includeAll',
        label: t('Include all changes (-a) — staged changes only when unchecked'),
        initial: true,
      },
    ],
    confirmLabel: 'Commit Fixup',
  })
  if (!values) return
  await graphStore.runAction(
    request('commitFixup', { repo, hash: commit.hash, includeAll: Boolean(values.includeAll) }),
    t('Fixup commit created (→ {0})', commit.hash.slice(0, 8)),
  )
}

/** fixup 커밋 우클릭: 대상 커밋 기준으로 rebase --autosquash 실행 ⚠️ */
export async function applyAutosquash(commit: Commit): Promise<void> {
  const repo = graphStore.currentRepo()
  if (!repo) return
  const target = resolveTarget(commit)
  if (!target) return
  const ok = await confirmDialog({
    title: `Squash Fixups into ${target.hash.slice(0, 8)}`,
    message:
      `"${target.subject}"\n\n` +
      t(
        'Squashes fixup!/squash! commits into their targets via rebase --autosquash.\nHashes of commits after the target will change — be careful if the range was already pushed.',
      ),
    confirmLabel: 'Squash',
    danger: true,
  })
  if (!ok) return
  await graphStore.runAction(
    request('autosquash', { repo, baseHash: target.hash }),
    t('Autosquash done (squashed into {0})', target.hash.slice(0, 8)),
  )
}
