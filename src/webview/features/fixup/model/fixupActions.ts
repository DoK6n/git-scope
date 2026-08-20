import type { Commit } from '@shared-types/domain'
import { graphStore } from '../../../entities/graph'
import { request } from '../../../shared/api'
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
      `대상 커밋("${fixupTargetSubject(commit.subject)}")을 로드된 범위에서 찾지 못했습니다 — 커밋을 더 로드해보세요.`,
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
    note: `fixup! ${commit.subject}\n\n이후 "Squash Fixups… (autosquash)"로 이 커밋에 합칠 수 있습니다.`,
    fields: [
      {
        kind: 'checkbox',
        name: 'includeAll',
        label: '모든 변경 포함 (-a) — 해제 시 스테이징된 변경만',
        initial: true,
      },
    ],
    confirmLabel: 'Commit Fixup',
  })
  if (!values) return
  await graphStore.runAction(
    request('commitFixup', { repo, hash: commit.hash, includeAll: Boolean(values.includeAll) }),
    `fixup 커밋 생성 완료 (→ ${commit.hash.slice(0, 8)})`,
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
      `rebase --autosquash로 fixup!/squash! 커밋들을 대상 커밋에 합칩니다.\n` +
      `대상 이후 커밋들의 해시가 바뀝니다 — 이미 푸시된 구간이면 주의하세요.`,
    confirmLabel: 'Squash',
    danger: true,
  })
  if (!ok) return
  await graphStore.runAction(
    request('autosquash', { repo, baseHash: target.hash }),
    `autosquash 완료 (${target.hash.slice(0, 8)}에 병합)`,
  )
}
