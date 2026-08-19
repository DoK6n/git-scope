import { For, Show } from 'solid-js'
import type { Worktree } from '@shared-types/domain'
import { graphStore } from '../../../entities/graph'
import { worktreeStore } from '../../../features/worktree'
import { openContextMenu } from '../../../shared/ui'
import type { MenuItem } from '../../../shared/ui'

/** worktree 우클릭 메뉴 — Move / Repair / Remove / Lock (원본 IDE 스타일) */
function buildWorktreeMenu(worktree: Worktree): MenuItem[] {
  const items: MenuItem[] = []
  if (!worktree.isMain) {
    items.push({ label: 'Move Worktree', onClick: () => void worktreeStore.moveWorktree(worktree) })
  }
  items.push({ label: 'Repair Worktree', onClick: () => void worktreeStore.repairWorktree(worktree) })
  if (!worktree.isMain) {
    items.push(
      {
        label: 'Remove Worktree',
        danger: true,
        separatorBefore: true,
        onClick: () => void worktreeStore.removeWorktree(worktree),
      },
      {
        label: worktree.locked ? 'Unlock Worktree' : 'Lock Worktree',
        separatorBefore: true,
        onClick: () => void worktreeStore.toggleLockWorktree(worktree),
      },
    )
  }
  return items
}

/** codicon 스타일의 열린 폴더 아이콘 (새 창으로 열기) */
function FolderOpenIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.2">
      <path d="M1.5 12.5 V3.5 h4.2 L7.2 5.2 h6.3 V6.8" stroke-linejoin="round" />
      <path d="M1.5 12.5 L3.6 7 h11.2 l-2.1 5.5 Z" stroke-linejoin="round" />
    </svg>
  )
}

/** 오른쪽 화살표 아이콘 (현재 창에서 열기) */
function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4">
      <path d="M2.5 8 H13" stroke-linecap="round" />
      <path d="M9.5 4.5 L13 8 l-3.5 3.5" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  )
}

/** worktree 목록 패널 — ✓ 현재 / ▢ 기타 / ✨ 메인, hover 시 열기 액션 */
export function WorktreePanel() {
  const isCurrent = (worktree: Worktree) => worktree.path === graphStore.currentRepo()

  return (
    <Show when={worktreeStore.panelOpen()}>
      <div class="worktree-panel">
        <div class="worktree-header">
          <span>Worktrees</span>
          <button class="details-close" style={{ position: 'static' }} onClick={worktreeStore.closePanel}>
            ✕
          </button>
        </div>
        <div class="worktree-list">
          <Show
            when={!worktreeStore.loading()}
            fallback={<div class="details-loading">Loading…</div>}
          >
            <For each={worktreeStore.worktrees()}>
              {(worktree) => (
                <div
                  class="worktree-item"
                  classList={{ current: isCurrent(worktree) }}
                  onContextMenu={(e) => openContextMenu(e, buildWorktreeMenu(worktree))}
                >
                  <span class="worktree-status" title={isCurrent(worktree) ? 'current window' : 'worktree'}>
                    {isCurrent(worktree) ? '✓' : '▢'}
                  </span>
                  <span class="worktree-branch">
                    {worktree.branch ?? `(detached: ${worktree.head.slice(0, 8)})`}
                  </span>
                  <Show when={worktree.isMain}>
                    <span class="worktree-main-mark" title="main worktree">✨</span>
                  </Show>
                  <Show when={worktree.locked}>
                    <span title="locked">🔒</span>
                  </Show>
                  <span class="worktree-path" title={worktree.path}>
                    {worktree.path}
                  </span>
                  <span class="worktree-hover-actions">
                    <button
                      class="worktree-action-btn"
                      title="Open in New Window"
                      onClick={(e) => {
                        e.stopPropagation()
                        void worktreeStore.openWorktree(worktree.path, true)
                      }}
                    >
                      <FolderOpenIcon />
                    </button>
                    <button
                      class="worktree-action-btn"
                      title="Open in This Window"
                      onClick={(e) => {
                        e.stopPropagation()
                        void worktreeStore.openWorktree(worktree.path, false)
                      }}
                    >
                      <ArrowRightIcon />
                    </button>
                  </span>
                </div>
              )}
            </For>
          </Show>
        </div>
        <div class="worktree-footer">
          <button class="toolbar-btn primary" onClick={() => void worktreeStore.addWorktree()}>
            + Add Worktree
          </button>
        </div>
      </div>
    </Show>
  )
}
