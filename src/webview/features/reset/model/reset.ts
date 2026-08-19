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
  const target = to.startsWith('HEAD') ? to : to.slice(0, 8)
  await graphStore.runAction(
    request('reset', { repo, to, mode: mode as 'soft' | 'mixed' | 'hard' }),
    // 원격 ref가 남아 있으면 그래프 행이 그대로라 실행 여부가 안 보인다 — 성공을 명시적으로 알린다
    `git reset --${mode} ${target} 완료 — 브랜치 라벨과 HEAD(●) 위치가 이동했습니다`,
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
    note: `${headBranch} 브랜치가 이 커밋을 가리키도록 이동합니다. 이 커밋보다 위(이후)의 커밋들이 브랜치에서 제외됩니다.`,
    fields: [MODE_FIELD],
    confirmLabel: 'Reset',
    warning: (v) => {
      if (isAlreadyHead)
        return '이 커밋은 이미 HEAD입니다 — reset해도 아무것도 바뀌지 않습니다. 마지막 커밋을 되돌리려면 바로 아래(부모) 커밋에서 reset 하세요.'
      return hardWarning(v)
    },
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
