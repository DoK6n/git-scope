import type { Commit } from '@shared-types/domain'
import { graphStore } from '../../../entities/graph'
import { createBranchAt } from '../../../features/branch'
import { checkoutCommit } from '../../../features/checkout'
import { applyAutosquash, createFixupCommit, fixupKind } from '../../../features/fixup'
import {
  cherryPick,
  dropCommit,
  rebaseOnto,
  revertCommit,
  rewordCommit,
} from '../../../features/commit-actions'
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

  // 원본 Git Graph의 커밋 메뉴 이름·순서를 따른다 (Undo/Drop은 GitScope 고유 — reset 계열 옆)
  const hash = commit.hash
  const uncommittedCount = graphStore.graph()?.uncommittedCount ?? 0
  return [
    // fixup 커밋이면 autosquash가 주 액션 — 맨 위에 노출
    ...(fixupKind(commit.subject)
      ? [
          {
            label: 'Squash Fixups into Target... (autosquash)',
            danger: true,
            onClick: () => void applyAutosquash(commit),
          } satisfies MenuItem,
        ]
      : []),
    { label: 'Add Tag...', onClick: () => void createTagAt(hash) },
    { label: 'Create Branch...', onClick: () => void createBranchAt(hash) },
    {
      label: 'Checkout...',
      separatorBefore: true,
      onClick: () => void checkoutCommit(hash),
    },
    { label: 'Cherry Pick...', onClick: () => void cherryPick(commit) },
    { label: 'Revert...', onClick: () => void revertCommit(commit) },
    { label: 'Edit Commit Message...', onClick: () => void rewordCommit(commit) },
    // 워킹트리에 변경이 있을 때만 — 현재 작업분을 이 커밋용 fixup으로 저장
    ...(uncommittedCount > 0
      ? [
          {
            label: 'Create Fixup Commit... (--fixup)',
            onClick: () => void createFixupCommit(commit),
          } satisfies MenuItem,
        ]
      : []),
    {
      label: 'Merge into current branch...',
      separatorBefore: true,
      onClick: () => void mergeInto(hash),
    },
    {
      label: 'Rebase current branch on this Commit...',
      onClick: () => void rebaseOnto(hash, hash.slice(0, 8)),
    },
    {
      label: 'Reset current branch to this Commit...',
      danger: true,
      onClick: () => void resetToCommit(hash),
    },
    {
      label: 'Undo this Commit & above... (reset to parent)',
      danger: true,
      onClick: () => void undoCommitsFrom(hash, commit.parents),
    },
    {
      label: 'Drop Commit...',
      danger: true,
      onClick: () => void dropCommit(commit),
    },
    {
      label: 'Copy Commit Hash to Clipboard',
      separatorBefore: true,
      onClick: () => copy(hash),
    },
    { label: 'Copy Commit Subject to Clipboard', onClick: () => copy(commit.subject) },
  ]
}
