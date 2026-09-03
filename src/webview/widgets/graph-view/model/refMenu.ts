import type { GitRef } from '@shared-types/domain'
import { createBranchAt, deleteBranch, renameBranch } from '../../../features/branch'
import { checkoutBranch, checkoutRemoteBranch } from '../../../features/checkout'
import { rebaseOnto } from '../../../features/commit-actions'
import { mergeInto } from '../../../features/merge'
import {
  deleteRemoteBranch,
  fetchIntoLocal,
  pullBranch,
  pullLocalBranch,
  pushBranch,
  pushTag,
} from '../../../features/remote-actions'
import { deleteTag, viewTagDetails } from '../../../features/tag'
import { worktreeStore } from '../../../features/worktree'
import { graphStore } from '../../../entities/graph'
import { request } from '../../../shared/api'
import { t } from '../../../shared/lib'
import type { MenuItem } from '../../../shared/ui'

const copy = (text: string) => void request('copyToClipboard', { text })

/** 브랜치 필터에서 이 ref를 추가/제거 */
function dropdownToggleItem(name: string): MenuItem {
  const current = graphStore.branchFilter()
  const isSelected = current?.includes(name) ?? false
  return {
    label: isSelected ? 'Unselect in Branches Dropdown' : 'Select in Branches Dropdown',
    intent: 'read',
    onClick: () => {
      const next = isSelected
        ? (current ?? []).filter((n) => n !== name)
        : [...(current ?? []), name]
      void graphStore.applyBranchFilter(next.length === 0 ? null : next)
    },
  }
}

/** 브랜치/태그 라벨 우클릭 메뉴 구성 */
export function buildRefMenu(ref: GitRef): MenuItem[] {
  if (ref.type === 'tag') {
    return [
      { label: 'View Tag Details', intent: 'read', onClick: () => void viewTagDetails(ref.name) },
      { label: 'Push Tag…', intent: 'change', onClick: () => void pushTag(ref.name) },
      { label: 'Delete Tag…', intent: 'change', danger: true, onClick: () => void deleteTag(ref.name) },
      { label: 'Copy Tag Name', intent: 'read', separatorBefore: true, onClick: () => copy(ref.name) },
    ]
  }

  if (ref.type === 'remote') {
    const remote = ref.remote ?? 'origin'
    const branchName = ref.name.slice(remote.length + 1)
    // origin/HEAD 심볼릭 참조는 브랜치 액션 대상이 아니다
    if (branchName === 'HEAD') {
      return [{ label: 'Copy Ref Name', intent: 'read', onClick: () => copy(ref.name) }]
    }
    return [
      {
        label: 'Checkout as Local Branch…',
        intent: 'change',
        onClick: () => void checkoutRemoteBranch(ref.name, remote),
      },
      {
        label: 'Create Branch from Here…',
        intent: 'change',
        onClick: () => void createBranchAt(ref.name, ref.name),
      },
      { label: 'Merge into Current Branch…', intent: 'change', onClick: () => void mergeInto(ref.name) },
      { label: 'Pull into Current Branch…', intent: 'change', onClick: () => void pullBranch(remote, branchName) },
      {
        label: 'Fetch into Local Branch…',
        intent: 'change',
        onClick: () => void fetchIntoLocal(remote, branchName),
      },
      {
        label: 'Delete Remote Branch…',
        intent: 'change',
        danger: true,
        separatorBefore: true,
        onClick: () => void deleteRemoteBranch(remote, branchName),
      },
      { separatorBefore: true, ...dropdownToggleItem(ref.name) },
      { label: 'Copy Branch Name', intent: 'read', onClick: () => copy(ref.name) },
    ]
  }

  // 로컬 브랜치 — 체크아웃된 브랜치에는 checkout/delete/merge/rebase를 숨긴다 (스펙 20-actions)
  const isCheckedOut = graphStore.graph()?.headBranch === ref.name
  const isWorktree = (graphStore.graph()?.worktreeBranches ?? []).includes(ref.name)
  const items: MenuItem[] = []
  if (!isCheckedOut && !isWorktree) {
    items.push({ label: 'Checkout Branch', intent: 'change', onClick: () => void checkoutBranch(ref.name) })
  }
  if (isWorktree) {
    // worktree에 체크아웃된 브랜치는 checkout 불가(git 제약) → 해당 worktree를 새 창으로
    items.push({
      label: 'Open Worktree in New Window',
      intent: 'read',
      onClick: () => void worktreeStore.openWorktreeForBranch(ref.name),
    })
  }
  items.push({
    label: 'Create Branch from Here…',
    intent: 'change',
    onClick: () => void createBranchAt(ref.name, ref.name),
  })
  items.push({ label: 'Rename Branch…', intent: 'change', onClick: () => void renameBranch(ref.name) })
  if (!isCheckedOut) {
    items.push(
      { label: 'Merge into Current Branch…', intent: 'change', onClick: () => void mergeInto(ref.name) },
      {
        label: 'Rebase Current Branch on Branch…',
        intent: 'change',
        onClick: () => void rebaseOnto(ref.name, ref.name),
      },
    )
  }
  items.push({ label: 'Push Branch…', intent: 'change', onClick: () => void pushBranch(ref.name) })
  items.push({ label: t('Pull Branch…'), intent: 'change', onClick: () => void pullLocalBranch(ref.name) })
  if (!isCheckedOut) {
    items.push({
      label: 'Delete Branch…',
      intent: 'change',
      danger: true,
      onClick: () => void deleteBranch(ref.name),
    })
  }
  items.push({ separatorBefore: true, ...dropdownToggleItem(ref.name) })
  items.push({ label: 'Copy Branch Name', intent: 'read', onClick: () => copy(ref.name) })
  return items
}
