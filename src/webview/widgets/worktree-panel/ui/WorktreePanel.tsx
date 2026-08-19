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
                      📂
                    </button>
                    <button
                      class="worktree-action-btn"
                      title="Open in This Window"
                      onClick={(e) => {
                        e.stopPropagation()
                        void worktreeStore.openWorktree(worktree.path, false)
                      }}
                    >
                      →
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
