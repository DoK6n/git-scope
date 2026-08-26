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
import { formatDate, t } from '../../../shared/lib'
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
                  onClick={() => {
                    // 고아 스태시는 베이스가 로그에 없어 그래프로 이동할 수 없다
                    if (stash.isOrphan) {
                      graphStore.setNotice(
                        t('Orphan stash — its base commit was deleted, so it cannot be shown in the graph. Apply/Drop still work.'),
                      )
                      return
                    }
                    // 클릭 = 그래프에서 해당 스태시 선택 + 화면 중앙으로 스크롤 (범위 밖이면 추가 로드)
                    graphStore.setSelectedCommit(stash.hash)
                    void graphStore.scrollToHash(stash.hash)
                  }}
                  onContextMenu={(e) => openContextMenu(e, buildStashMenu(stash))}
                >
                  <span
                    class="stash-item-check"
                    classList={{ checked: stashPanelStore.selected().has(stash.selector) }}
                    title={t('Select for bulk actions')}
                    onClick={(e) => {
                      e.stopPropagation()
                      stashPanelStore.toggleSelected(stash.selector)
                    }}
                  >
                    ✓
                  </span>
                  <span class="stash-item-selector">{stash.selector}</span>
                  <Show when={stash.isOrphan}>
                    <span
                      class="stash-orphan-mark"
                      title={t('The base commit is unreachable from any branch/tag (branch deleted or rebased). Not shown in the graph, but Apply/Drop still work.')}
                    >
                      orphan
                    </span>
                  </Show>
                  <span class="stash-item-subject" title={stash.subject}>
                    {stash.subject}
                  </span>
                  <span class="stash-item-date">{formatDate(stash.authorDate)}</span>
                </div>
              )}
            </For>
            <Show when={stashPanelStore.stashes().length === 0}>
              <div class="branch-filter-empty">{t('No stashes')}</div>
            </Show>
          </Show>
        </div>
        <div class="worktree-footer">
          <Show when={stashPanelStore.selected().size > 0}>
            <button
              class="toolbar-btn danger"
              onClick={() => void stashPanelStore.dropSelected()}
              title={t('Drop all checked stashes')}
            >
              Drop Selected ({stashPanelStore.selected().size})
            </button>
          </Show>
          <button
            class="toolbar-btn primary"
            onClick={() => withReload(stashPush())}
            disabled={(graphStore.graph()?.uncommittedCount ?? 0) === 0}
            title={t('Stash working tree changes')}
          >
            + Stash Uncommitted Changes
          </button>
        </div>
      </div>
    </Show>
  )
}
