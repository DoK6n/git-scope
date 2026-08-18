import type { GitRef } from '@shared-types/domain'
import { deleteBranch, renameBranch } from '../../../features/branch'
import { checkoutBranch, checkoutRemoteBranch } from '../../../features/checkout'
import { mergeInto } from '../../../features/merge'
import { deleteTag } from '../../../features/tag'
import { worktreeStore } from '../../../features/worktree'
import { graphStore } from '../../../entities/graph'
import { request } from '../../../shared/api'
import type { MenuItem } from '../../../shared/ui'

/** 브랜치/태그 라벨 우클릭 메뉴 구성 */
export function buildRefMenu(ref: GitRef): MenuItem[] {
  const copyItem: MenuItem = {
    label: `Copy ${ref.type === 'tag' ? 'Tag' : 'Branch'} Name`,
    separatorBefore: true,
    onClick: () => void request('copyToClipboard', { text: ref.name }),
  }

  if (ref.type === 'tag') {
    return [
      { label: 'Delete Tag…', danger: true, onClick: () => void deleteTag(ref.name) },
      copyItem,
    ]
  }

  if (ref.type === 'remote') {
    return [
      {
        label: 'Checkout as Local Branch…',
        onClick: () => void checkoutRemoteBranch(ref.name),
      },
      { label: 'Merge into Current Branch…', onClick: () => void mergeInto(ref.name) },
      copyItem,
    ]
  }

  // 로컬 브랜치 — 체크아웃된 브랜치에는 checkout/delete/merge를 숨긴다 (스펙 20-actions 조건부 표시)
  const isCheckedOut = graphStore.graph()?.headBranch === ref.name
  const isWorktree = (graphStore.graph()?.worktreeBranches ?? []).includes(ref.name)
  const items: MenuItem[] = []
  if (!isCheckedOut && !isWorktree) {
    items.push({ label: 'Checkout Branch', onClick: () => void checkoutBranch(ref.name) })
  }
  if (isWorktree) {
    // worktree에 체크아웃된 브랜치는 checkout 불가(git 제약) → 해당 worktree를 새 창으로
    items.push({
      label: 'Open Worktree in New Window',
      onClick: () => void worktreeStore.openWorktreeForBranch(ref.name),
    })
  }
  items.push({ label: 'Rename Branch…', onClick: () => void renameBranch(ref.name) })
  if (!isCheckedOut) {
    items.push(
      {
        label: 'Merge into Current Branch…',
        onClick: () => void mergeInto(ref.name),
      },
      {
        label: 'Delete Branch…',
        danger: true,
        onClick: () => void deleteBranch(ref.name),
      },
    )
  }
  items.push(copyItem)
  return items
}
