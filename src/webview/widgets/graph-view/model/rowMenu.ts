import type { Commit } from '@shared-types/domain'
import { createBranchAt } from '../../../features/branch'
import { checkoutCommit } from '../../../features/checkout'
import { cherryPick, dropCommit, rebaseOnto, revertCommit } from '../../../features/commit-actions'
import { mergeInto } from '../../../features/merge'
import { resetToCommit, undoCommitsFrom } from '../../../features/reset'
import {
  cleanUntracked,
  discardAllChanges,
  openScmView,
  stashApply,
  stashBranch,
  stashDrop,
  stashPush,
} from '../../../features/stash'
import { createTagAt } from '../../../features/tag'
import { request } from '../../../shared/api'
import type { MenuItem } from '../../../shared/ui'

const copy = (text: string) => void request('copyToClipboard', { text })

/** 커밋 행 우클릭 메뉴 구성 — uncommitted/stash/일반 커밋별로 다르다 */
export function buildRowMenu(commit: Commit): MenuItem[] {
  if (commit.isUncommitted) {
    return [
      { label: 'Stash Uncommitted Changes…', onClick: () => void stashPush() },
      { label: 'Open Source Control View', onClick: () => void openScmView() },
      {
        label: 'Clean Untracked Files…',
        danger: true,
        separatorBefore: true,
        onClick: () => void cleanUntracked(),
      },
      {
        label: 'Discard All Changes… (reset --hard)',
        danger: true,
        onClick: () => void discardAllChanges(),
      },
    ]
  }

  if (commit.stashSelector) {
    const selector = commit.stashSelector
    return [
      { label: 'Apply Stash…', onClick: () => void stashApply(selector, false) },
      { label: 'Pop Stash…', onClick: () => void stashApply(selector, true) },
      { label: 'Create Branch from Stash…', onClick: () => void stashBranch(selector) },
      {
        label: 'Drop Stash…',
        danger: true,
        separatorBefore: true,
        onClick: () => void stashDrop(selector),
      },
      {
        label: 'Copy Stash Name',
        separatorBefore: true,
        onClick: () => copy(selector),
      },
      { label: 'Copy Stash Hash', onClick: () => copy(commit.hash) },
    ]
  }

  const hash = commit.hash
  return [
    { label: 'Checkout Commit…', onClick: () => void checkoutCommit(hash) },
    { label: 'Create Branch Here…', onClick: () => void createBranchAt(hash) },
    { label: 'Create Tag Here…', onClick: () => void createTagAt(hash) },
    { label: 'Merge into Current Branch…', onClick: () => void mergeInto(hash) },
    {
      label: 'Cherry Pick…',
      separatorBefore: true,
      onClick: () => void cherryPick(commit),
    },
    { label: 'Revert…', onClick: () => void revertCommit(commit) },
    {
      label: 'Rebase Current Branch on This Commit…',
      onClick: () => void rebaseOnto(hash, hash.slice(0, 8)),
    },
    {
      label: 'Drop Commit…',
      danger: true,
      separatorBefore: true,
      onClick: () => void dropCommit(commit),
    },
    {
      label: 'Undo This Commit & Above… (reset to parent)',
      danger: true,
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
      onClick: () => copy(hash),
    },
    { label: 'Copy Commit Subject', onClick: () => copy(commit.subject) },
  ]
}
