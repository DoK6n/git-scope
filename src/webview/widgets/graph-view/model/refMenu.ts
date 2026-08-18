import type { GitRef } from '@shared-types/domain'
import { deleteBranch, renameBranch } from '../../../features/branch'
import { checkoutBranch, checkoutRemoteBranch } from '../../../features/checkout'
import { mergeInto } from '../../../features/merge'
import { deleteTag } from '../../../features/tag'
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
