import { graphStore } from '../../../entities/graph'
import { request } from '../../../shared/api'
import { formDialog } from '../../../shared/ui'
import type { FormValues } from '../../../shared/ui'

const MODE_FIELD = {
  kind: 'radio' as const,
  name: 'mode',
  label: 'Reset mode',
  options: [
    { value: 'soft', label: '--soft', hint: '인덱스·워킹트리 보존, HEAD만 이동' },
    { value: 'mixed', label: '--mixed', hint: '인덱스 리셋, 워킹트리 보존 (기본값)' },
    { value: 'hard', label: '--hard', hint: '인덱스·워킹트리 모두 폐기', danger: true },
  ],
  initial: 'mixed',
}

/** hard 모드 선택 시 경고 — 설정으로 끌 수 없다 (스펙 60-new-features §1) */
const hardWarning = (values: FormValues) =>
  values.mode === 'hard'
    ? '워킹트리와 인덱스의 모든 변경사항이 영구히 삭제됩니다. 되돌릴 수 없습니다.'
    : null

async function runReset(to: string, mode: string): Promise<void> {
  const repo = graphStore.currentRepo()
  if (!repo) return
  await graphStore.runAction(
    request('reset', { repo, to, mode: mode as 'soft' | 'mixed' | 'hard' }),
  )
}

/** 커밋 우클릭 → 현재 브랜치를 해당 커밋으로 reset */
export async function resetToCommit(hash: string): Promise<void> {
  const headBranch = graphStore.graph()?.headBranch ?? 'HEAD'
  const values = await formDialog({
    title: `Reset ${headBranch} to ${hash.slice(0, 8)}`,
    fields: [MODE_FIELD],
    confirmLabel: 'Reset',
    warning: hardWarning,
  })
  if (!values) return
  await runReset(hash, String(values.mode))
}

/** 툴바 → HEAD~N 타겟 reset */
export async function resetHeadN(): Promise<void> {
  const values = await formDialog({
    title: 'Reset to HEAD~N',
    fields: [
      { kind: 'number', name: 'n', label: 'N (HEAD에서 거슬러 올라갈 커밋 수)', initial: 1, min: 0 },
      MODE_FIELD,
    ],
    confirmLabel: 'Reset',
    warning: hardWarning,
  })
  if (!values) return
  const n = Math.max(0, Math.floor(Number(values.n)))
  await runReset(`HEAD~${n}`, String(values.mode))
}
