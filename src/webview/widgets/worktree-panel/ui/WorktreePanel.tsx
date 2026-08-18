import { For, Show } from 'solid-js'
import { worktreeStore } from '../../../features/worktree'

/** worktree 목록/추가/제거 패널 (툴바에서 토글) */
export function WorktreePanel() {
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
                <div class="worktree-item">
                  <div class="worktree-info">
                    <div class="worktree-branch">
                      {worktree.branch ?? `(detached: ${worktree.head.slice(0, 8)})`}
                      <Show when={worktree.isMain}> · main</Show>
                      <Show when={worktree.locked}> · 🔒</Show>
                    </div>
                    <div class="worktree-path" title={worktree.path}>
                      {worktree.path}
                    </div>
                  </div>
                  <div class="worktree-actions">
                    <button
                      class="toolbar-btn"
                      title="Open in new window"
                      onClick={() => void worktreeStore.openWorktree(worktree.path)}
                    >
                      Open
                    </button>
                    <Show when={!worktree.isMain}>
                      <button
                        class="toolbar-btn danger"
                        title="git worktree remove"
                        onClick={() => void worktreeStore.removeWorktree(worktree)}
                      >
                        Remove
                      </button>
                    </Show>
                  </div>
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
