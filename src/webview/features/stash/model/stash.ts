import { graphStore } from '../../../entities/graph'
import { request } from '../../../shared/api'
import { confirmDialog, formDialog } from '../../../shared/ui'

function repo(): string | null {
  return graphStore.currentRepo()
}

export async function stashApply(selector: string, pop: boolean): Promise<void> {
  const r = repo()
  if (!r) return
  const values = await formDialog({
    title: `${pop ? 'Pop' : 'Apply'} Stash: ${selector}`,
    fields: [
      { kind: 'checkbox', name: 'reinstateIndex', label: '인덱스(스테이징)도 복원 (--index)', initial: false },
    ],
    confirmLabel: pop ? 'Pop' : 'Apply',
  })
  if (!values) return
  await graphStore.runAction(
    request(pop ? 'stashPop' : 'stashApply', {
      repo: r,
      selector,
      reinstateIndex: Boolean(values.reinstateIndex),
    }),
    `stash ${pop ? 'pop' : 'apply'} ${selector} 완료`,
  )
}

export async function stashDrop(selector: string): Promise<void> {
  const r = repo()
  if (!r) return
  const ok = await confirmDialog({
    title: `Drop Stash: ${selector}`,
    message: '이 스태시를 삭제합니다. 되돌릴 수 없습니다.',
    confirmLabel: 'Drop',
    danger: true,
  })
  if (!ok) return
  await graphStore.runAction(
    request('stashDrop', { repo: r, selector }),
    `stash drop ${selector} 완료`,
  )
}

export async function stashBranch(selector: string): Promise<void> {
  const r = repo()
  if (!r) return
  const values = await formDialog({
    title: `Create Branch from Stash: ${selector}`,
    fields: [{ kind: 'text', name: 'name', label: 'Branch name', placeholder: 'feature/…' }],
    confirmLabel: 'Create',
  })
  if (!values || String(values.name).trim() === '') return
  await graphStore.runAction(
    request('stashBranch', { repo: r, selector, branchName: String(values.name).trim() }),
    `stash → 브랜치 ${values.name} 생성 완료`,
  )
}

/** uncommitted 행: 워킹트리 변경을 stash로 저장 */
export async function stashPush(): Promise<void> {
  const r = repo()
  if (!r) return
  const values = await formDialog({
    title: 'Stash Uncommitted Changes',
    fields: [
      { kind: 'text', name: 'message', label: 'Message (선택)', initial: '' },
      { kind: 'checkbox', name: 'includeUntracked', label: '추적되지 않은 파일 포함', initial: true },
    ],
    confirmLabel: 'Stash',
  })
  if (!values) return
  await graphStore.runAction(
    request('stashPush', {
      repo: r,
      message: String(values.message),
      includeUntracked: Boolean(values.includeUntracked),
    }),
    'stash 저장 완료',
  )
}

/** uncommitted 행: 추적되지 않은 파일 삭제 ⚠️ */
export async function cleanUntracked(): Promise<void> {
  const r = repo()
  if (!r) return
  const values = await formDialog({
    title: 'Clean Untracked Files',
    fields: [
      { kind: 'checkbox', name: 'directories', label: '디렉토리도 삭제 (-d)', initial: true },
    ],
    confirmLabel: 'Clean',
    danger: true,
    warning: () => '추적되지 않은 파일이 영구히 삭제됩니다. 되돌릴 수 없습니다.',
  })
  if (!values) return
  await graphStore.runAction(
    request('cleanUntracked', { repo: r, directories: Boolean(values.directories) }),
    'clean 완료',
  )
}

/** uncommitted 행: 모든 변경 폐기 ⚠️ */
export async function discardAllChanges(): Promise<void> {
  const r = repo()
  if (!r) return
  const ok = await confirmDialog({
    title: 'Discard All Changes',
    message: '워킹트리와 인덱스의 모든 변경사항을 폐기합니다 (reset --hard HEAD).\n되돌릴 수 없습니다.',
    confirmLabel: 'Discard',
    danger: true,
  })
  if (!ok) return
  await graphStore.runAction(request('discardAllChanges', { repo: r }), '변경사항 폐기 완료')
}

export async function openScmView(): Promise<void> {
  await request('openScmView', {})
}
