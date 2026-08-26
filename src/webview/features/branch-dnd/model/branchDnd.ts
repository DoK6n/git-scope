import type { GitRef } from '@shared-types/domain'
import { graphStore } from '../../../entities/graph'
import { request } from '../../../shared/api'
import { t } from '../../../shared/lib'
import { formDialog } from '../../../shared/ui'

/** 브랜치 뱃지 드래그 페이로드 MIME — dragover 단계에서는 types로만 판별한다 */
const BRANCH_MIME = 'application/x-gitscope-branch'

interface BranchDragPayload {
  name: string
  isRemote: boolean
}

/** 브랜치 뱃지 드래그 시작 — 로컬/원격 브랜치만 (태그 제외) */
export function startBranchDrag(e: DragEvent, ref: GitRef): void {
  if (!e.dataTransfer) return
  e.dataTransfer.effectAllowed = 'link'
  const payload: BranchDragPayload = { name: ref.name, isRemote: ref.type === 'remote' }
  e.dataTransfer.setData(BRANCH_MIME, JSON.stringify(payload))
}

/** 진행 중인 드래그가 브랜치 뱃지 드래그인지 (dragover에서 데이터는 못 읽고 타입만 확인 가능) */
export function isBranchDrag(e: DragEvent): boolean {
  return [...(e.dataTransfer?.types ?? [])].includes(BRANCH_MIME)
}

/** 드롭 이벤트에서 페이로드를 꺼내 merge/rebase 선택 다이얼로그로 넘긴다 */
export async function dropBranchOn(e: DragEvent, target: string): Promise<void> {
  const raw = e.dataTransfer?.getData(BRANCH_MIME)
  if (!raw) return
  let source: BranchDragPayload
  try {
    source = JSON.parse(raw) as BranchDragPayload
  } catch {
    return
  }
  if (!source.name || source.name === target) return
  await confirmBranchDrop(source, target)
}

/**
 * 드롭한 브랜치(source)를 대상 브랜치(target)에 어떻게 반영할지 선택:
 * - Merge: target 체크아웃(필요시) 후 `git merge source`
 * - Rebase: `git rebase target source` — source 커밋 해시가 바뀐다 ⚠️ (원격 source에는 제공하지 않음)
 */
export async function confirmBranchDrop(
  source: BranchDragPayload,
  target: string,
): Promise<void> {
  const repo = graphStore.currentRepo()
  if (!repo) return
  const headBranch = graphStore.graph()?.headBranch ?? null
  const options = [
    {
      value: 'merge',
      label: `Merge ${source.name} into ${target}`,
      hint:
        headBranch === target
          ? `git merge ${source.name}`
          : t('checkout {0}, then merge (HEAD moves)', target),
    },
    ...(source.isRemote
      ? []
      : [
          {
            value: 'rebase',
            label: `Rebase ${source.name} onto ${target}`,
            hint: `git rebase ${target} ${source.name}`,
            danger: true,
          },
        ]),
  ]
  const values = await formDialog({
    title: `${source.name} → ${target}`,
    note: t('Choose what to do with the dropped branch.'),
    fields: [{ kind: 'radio', name: 'action', label: 'Action', options, initial: 'merge' }],
    confirmLabel: 'Run',
    warning: (v) =>
      v.action === 'rebase'
        ? t('Commit hashes of {0} will change and HEAD moves to {0}.', source.name)
        : null,
  })
  if (!values) return
  if (values.action === 'rebase') {
    await graphStore.runAction(
      request('rebaseBranchOnto', { repo, branch: source.name, onto: target }),
      t('Rebased {0} onto {1}', source.name, target),
    )
  } else {
    await graphStore.runAction(
      request('mergeBranchInto', { repo, source: source.name, target }),
      t('Merged {0} into {1}', source.name, target),
    )
  }
}
