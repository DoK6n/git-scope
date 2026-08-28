import { graphStore } from '../../../entities/graph'
import { request } from '../../../shared/api'
import { t } from '../../../shared/lib'
import { formDialog } from '../../../shared/ui'
import type { FormValues } from '../../../shared/ui'

// 다이얼로그를 열 때마다 평가한다 — 언어 설정 변경이 힌트에 반영되도록 함수로 둔다
// (export는 슬라이스 내부 공용 — dragReset도 동일한 모드 선택 UI를 쓴다)
export const modeField = () => ({
  kind: 'radio' as const,
  name: 'mode',
  label: 'Reset mode',
  options: [
    { value: 'soft', label: '--soft', hint: t('keep index & working tree, move HEAD only') },
    { value: 'mixed', label: '--mixed', hint: t('reset index, keep working tree (default)') },
    { value: 'hard', label: '--hard', hint: t('discard index & working tree'), danger: true },
  ],
  initial: 'mixed',
})

/** hard 모드 선택 시 경고 — 설정으로 끌 수 없다 (스펙 60-new-features §1) */
export const hardWarning = (values: FormValues) =>
  values.mode === 'hard'
    ? t('All changes in the working tree and index will be permanently lost. This cannot be undone.')
    : null

export async function runReset(to: string, mode: string): Promise<void> {
  const repo = graphStore.currentRepo()
  if (!repo) return
  const target = to.startsWith('HEAD') ? to : to.slice(0, 8)
  await graphStore.runAction(
    request('reset', { repo, to, mode: mode as 'soft' | 'mixed' | 'hard' }),
    // 원격 ref가 남아 있으면 그래프 행이 그대로라 실행 여부가 안 보인다 — 성공을 명시적으로 알린다
    t('git reset --{0} {1} done — branch label and HEAD (●) moved', mode, target),
  )
}

/** 커밋 우클릭 → 현재 브랜치를 해당 커밋으로 reset */
export async function resetToCommit(hash: string): Promise<void> {
  const graph = graphStore.graph()
  const headBranch = graph?.headBranch ?? 'HEAD'
  // 흔한 함정: 되돌리고 싶은 커밋 자체를 우클릭하면 이미 HEAD라 아무것도 바뀌지 않는다
  const isAlreadyHead = graph?.headHash === hash
  const values = await formDialog({
    title: `Reset ${headBranch} to ${hash.slice(0, 8)}`,
    note: t('Moves branch {0} to point at this commit. Commits above (after) it are removed from the branch.', headBranch),
    fields: [modeField()],
    confirmLabel: 'Reset',
    warning: (v) => {
      if (isAlreadyHead)
        return t('This commit is already HEAD — reset changes nothing. To undo the last commit, reset from its parent commit below.')
      return hardWarning(v)
    },
  })
  if (!values) return
  await runReset(hash, String(values.mode))
}

/**
 * 커밋 우클릭 → 이 커밋(과 그 위)을 되돌리기 = 부모로 reset.
 * HEAD 커밋에서 실행하면 터미널의 `git reset --<mode> HEAD~1`과 동일하다.
 */
export async function undoCommitsFrom(hash: string, parents: string[]): Promise<void> {
  const parent = parents[0]
  if (parent === undefined) {
    graphStore.setError(t('The root commit has no parent, so it cannot be undone this way.'))
    return
  }
  const headBranch = graphStore.graph()?.headBranch ?? 'HEAD'
  const values = await formDialog({
    title: `Undo commits from ${hash.slice(0, 8)}`,
    note: t('Commits from {0} to HEAD are removed from the branch, and {1} will point at the parent commit ({2}). Running this on the HEAD commit equals git reset HEAD~1.', hash.slice(0, 8), headBranch, parent.slice(0, 8)),
    fields: [modeField()],
    confirmLabel: 'Undo',
    warning: hardWarning,
  })
  if (!values) return
  await runReset(parent, String(values.mode))
}

/** 툴바 → HEAD~N 타겟 reset */
export async function resetHeadN(): Promise<void> {
  const values = await formDialog({
    title: 'Reset to HEAD~N',
    fields: [
      { kind: 'number', name: 'n', label: t('N (commits to go back from HEAD)'), initial: 1, min: 0 },
      modeField(),
    ],
    confirmLabel: 'Reset',
    warning: hardWarning,
  })
  if (!values) return
  const n = Math.max(0, Math.floor(Number(values.n)))
  await runReset(`HEAD~${n}`, String(values.mode))
}
