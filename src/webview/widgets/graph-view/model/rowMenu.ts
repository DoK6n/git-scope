import type { Commit } from '@shared-types/domain'
import { createBranchAt } from '../../../features/branch'
import { checkoutCommit } from '../../../features/checkout'
import { mergeInto } from '../../../features/merge'
import { resetToCommit, undoCommitsFrom } from '../../../features/reset'
import { createTagAt } from '../../../features/tag'
import { request } from '../../../shared/api'
import type { MenuItem } from '../../../shared/ui'

/** 커밋 행 우클릭 메뉴 구성 */
export function buildRowMenu(commit: Commit): MenuItem[] {
  if (commit.isUncommitted) return []
  const hash = commit.hash
  return [
    { label: 'Checkout Commit…', onClick: () => void checkoutCommit(hash) },
    { label: 'Create Branch Here…', onClick: () => void createBranchAt(hash) },
    { label: 'Create Tag Here…', onClick: () => void createTagAt(hash) },
    {
      label: 'Merge into Current Branch…',
      onClick: () => void mergeInto(hash),
    },
    {
      label: 'Undo This Commit & Above… (reset to parent)',
      danger: true,
      separatorBefore: true,
      onClick: () => void undoCommitsFrom(hash, commit.parents),
    },
    {
      label: 'Reset Current Branch to This Commit… (keep this)',
      danger: true,
      onClick: () => void resetToCommit(hash),
    },
    {
      label: 'Copy Commit Hash',
      separatorBefore: true,
      onClick: () => void request('copyToClipboard', { text: hash }),
    },
    {
      label: 'Copy Commit Subject',
      onClick: () => void request('copyToClipboard', { text: commit.subject }),
    },
  ]
}
