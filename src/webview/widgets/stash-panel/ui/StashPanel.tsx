import { For, Show } from 'solid-js'
import type { StashEntry } from '@shared-types/domain'
import { graphStore } from '../../../entities/graph'
import {
  stashApply,
  stashBranch,
  stashDrop,
  stashPanelStore,
  stashPush,
} from '../../../features/stash'
import { worktreeStore } from '../../../features/worktree'
import { request } from '../../../shared/api'
import { formatDate } from '../../../shared/lib'
import { openContextMenu } from '../../../shared/ui'
import type { MenuItem } from '../../../shared/ui'

/** 액션 후 스태시 목록·그래프가 함께 갱신되도록 감싼다 */
function withReload(action: Promise<void>): void {
  void action.then(() => stashPanelStore.reload())
}

function buildStashMenu(stash: StashEntry): MenuItem[] {
  return [
    { label: 'Apply Stash…', onClick: () => withReload(stashApply(stash.selector, false)) },
    { label: 'Pop Stash…', onClick: () => withReload(stashApply(stash.selector, true)) },
    { label: 'Create Branch from Stash…', onClick: () => withReload(stashBranch(stash.selector)) },
    {
      label: 'Drop Stash…',
      danger: true,
      separatorBefore: true,
      onClick: () => withReload(stashDrop(stash.selector)),
    },
    {
      label: 'Copy Stash Hash',
      separatorBefore: true,
      onClick: () => void request('copyToClipboard', { text: stash.hash }),
    },
  ]
}

/** 스태시 목록 패널 — 행 클릭 시 그래프에서 해당 스태시 선택 */
export function StashPanel() {
  return (
    <Show when={stashPanelStore.panelOpen()}>
      <div class="worktree-panel stash-panel" classList={{ shifted: worktreeStore.panelOpen() }}>
        <div class="worktree-header">
          <span>Stashes</span>
          <button
            class="details-close"
            style={{ position: 'static' }}
            onClick={stashPanelStore.closePanel}
          >
            ✕
          </button>
        </div>
        <div class="worktree-list">
          <Show
            when={!stashPanelStore.loading()}
            fallback={<div class="details-loading">Loading…</div>}
          >
            <For each={stashPanelStore.stashes()}>
              {(stash) => (
                <div
                  class="worktree-item stash-item"
                  onClick={() => graphStore.setSelectedCommit(stash.hash)}
                  onContextMenu={(e) => openContextMenu(e, buildStashMenu(stash))}
                >
                  <span class="stash-item-selector">{stash.selector}</span>
                  <span class="stash-item-subject" title={stash.subject}>
                    {stash.subject}
                  </span>
                  <span class="stash-item-date">{formatDate(stash.authorDate)}</span>
                </div>
              )}
            </For>
            <Show when={stashPanelStore.stashes().length === 0}>
              <div class="branch-filter-empty">스태시 없음</div>
            </Show>
          </Show>
        </div>
        <div class="worktree-footer">
          <button
            class="toolbar-btn primary"
            onClick={() => withReload(stashPush())}
            disabled={(graphStore.graph()?.uncommittedCount ?? 0) === 0}
            title="워킹트리 변경사항을 스태시로 저장"
          >
            + Stash Uncommitted Changes
          </button>
        </div>
      </div>
    </Show>
  )
}
