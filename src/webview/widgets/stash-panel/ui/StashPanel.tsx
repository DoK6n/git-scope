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
                  onClick={() => {
                    // 고아 스태시는 베이스가 로그에 없어 그래프로 이동할 수 없다
                    if (stash.isOrphan) {
                      graphStore.setNotice(
                        '고아 스태시 — 베이스 커밋이 삭제되어 그래프에 표시할 수 없습니다. Apply/Drop은 가능합니다.',
                      )
                      return
                    }
                    // 클릭 = 그래프에서 해당 스태시 선택 + 화면 중앙으로 스크롤 (범위 밖이면 추가 로드)
                    graphStore.setSelectedCommit(stash.hash)
                    void graphStore.scrollToHash(stash.hash)
                  }}
                  onContextMenu={(e) => openContextMenu(e, buildStashMenu(stash))}
                >
                  <input
                    type="checkbox"
                    class="stash-item-check"
                    checked={stashPanelStore.selected().has(stash.selector)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => stashPanelStore.toggleSelected(stash.selector)}
                  />
                  <span class="stash-item-selector">{stash.selector}</span>
                  <Show when={stash.isOrphan}>
                    <span
                      class="stash-orphan-mark"
                      title="베이스 커밋이 어떤 브랜치/태그에서도 도달할 수 없습니다 (브랜치 삭제 또는 rebase). 그래프에는 표시되지 않지만 Apply/Drop은 가능합니다."
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
              <div class="branch-filter-empty">스태시 없음</div>
            </Show>
          </Show>
        </div>
        <div class="worktree-footer">
          <Show when={stashPanelStore.selected().size > 0}>
            <button
              class="toolbar-btn danger"
              onClick={() => void stashPanelStore.dropSelected()}
              title="체크한 스태시 일괄 삭제"
            >
              Drop Selected ({stashPanelStore.selected().size})
            </button>
          </Show>
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
