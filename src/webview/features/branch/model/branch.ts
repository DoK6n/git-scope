import { graphStore } from '../../../entities/graph'
import { request } from '../../../shared/api'
import { formDialog } from '../../../shared/ui'

/** 특정 커밋/브랜치에서 새 브랜치 생성 (+선택적으로 checkout). label은 다이얼로그 표기용 */
export async function createBranchAt(at: string, label?: string): Promise<void> {
  const repo = graphStore.currentRepo()
  if (!repo) return
  const from = label ?? at.slice(0, 8)
  const values = await formDialog({
    title: `Create Branch from ${from}`,
    fields: [
      { kind: 'text', name: 'name', label: 'Branch name', placeholder: 'feature/…' },
      { kind: 'checkbox', name: 'checkout', label: 'Check out after creating', initial: true },
    ],
    confirmLabel: 'Create',
  })
  if (!values || String(values.name).trim() === '') return
  await graphStore.runAction(
    request('createBranch', {
      repo,
      name: String(values.name).trim(),
      at,
      checkout: Boolean(values.checkout),
    }),
    `브랜치 ${values.name} 생성 완료 (from ${from})`,
  )
}

/** 브랜치 삭제 — 병합되지 않았으면 강제 삭제 체크 필요 ⚠️ */
export async function deleteBranch(name: string): Promise<void> {
  const repo = graphStore.currentRepo()
  if (!repo) return
  const values = await formDialog({
    title: `Delete Branch: ${name}`,
    fields: [
      {
        kind: 'checkbox',
        name: 'force',
        label: 'Force delete (-D) — 병합되지 않은 커밋도 삭제',
        initial: false,
      },
    ],
    confirmLabel: 'Delete',
    danger: true,
    warning: (v) =>
      v.force ? '병합되지 않은 커밋이 유실될 수 있습니다.' : null,
  })
  if (!values) return
  await graphStore.runAction(
    request('deleteBranch', { repo, name, force: Boolean(values.force) }),
  )
}

/** 브랜치 이름 변경 */
export async function renameBranch(oldName: string): Promise<void> {
  const repo = graphStore.currentRepo()
  if (!repo) return
  const values = await formDialog({
    title: `Rename Branch: ${oldName}`,
    fields: [{ kind: 'text', name: 'newName', label: 'New name', initial: oldName }],
    confirmLabel: 'Rename',
  })
  if (!values) return
  const newName = String(values.newName).trim()
  if (newName === '' || newName === oldName) return
  await graphStore.runAction(request('renameBranch', { repo, oldName, newName }))
}
