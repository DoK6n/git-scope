import { For, Show } from 'solid-js'
import type { StashEntry, StashFileChange } from '@shared-types/domain'
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
import { formatDate, formatRelativeTime, t } from '../../../shared/lib'
import { GitIcon, openContextMenu } from '../../../shared/ui'
import type { MenuItem } from '../../../shared/ui'

/** 액션 후 스태시 목록·그래프가 함께 갱신되도록 감싼다. */
function withReload(action: Promise<void>): void {
  void action.then(() => stashPanelStore.reload())
}

function buildStashMenu(stash: StashEntry): MenuItem[] {
  return [
    { label: 'Apply Stash…', intent: 'change', onClick: () => withReload(stashApply(stash.selector, false)) },
    { label: 'Pop Stash…', intent: 'change', onClick: () => withReload(stashApply(stash.selector, true)) },
    { label: 'Create Branch from Stash…', intent: 'change', onClick: () => withReload(stashBranch(stash.selector)) },
    {
      label: 'Drop Stash…',
      intent: 'change',
      danger: true,
      separatorBefore: true,
      onClick: () => withReload(stashDrop(stash.selector)),
    },
    {
      label: 'Copy Stash Hash',
      intent: 'read',
      separatorBefore: true,
      onClick: () => void request('copyToClipboard', { text: stash.hash }),
    },
  ]
}

function stopAnd(run: () => void): (event: MouseEvent) => void {
  return (event) => {
    event.stopPropagation()
    run()
  }
}

function selectStash(stash: StashEntry): void {
  if (stash.isOrphan) {
    graphStore.setNotice(
      t('Orphan stash — its base commit was deleted, so it cannot be shown in the graph. Apply/Drop still work.'),
    )
    return
  }
  graphStore.setSelectedCommit(stash.hash)
  void graphStore.scrollToHash(stash.hash)
}

/** 기존 commit comparison 상세 패널에서 stash base ↔ stash commit을 보여준다. */
function compareStash(stash: StashEntry): void {
  if (stash.isOrphan) {
    if (!stashPanelStore.expanded().has(stash.selector)) {
      void stashPanelStore.toggleExpanded(stash.selector)
    }
    graphStore.setNotice(t('This orphan stash can only be compared one file at a time below.'))
    return
  }
  graphStore.setSelectedCommit(stash.hash)
  graphStore.setCompareWith(stash.baseHash)
  void graphStore.scrollToHash(stash.hash)
}

function openStashDiff(file: StashFileChange): void {
  const repo = graphStore.currentRepo()
  if (!repo) return
  void request('openDiff', {
    repo,
    hash: file.hash,
    baseHash: file.baseHash,
    path: file.path,
    oldPath: file.oldPath,
  }).then((result) => {
    if (!result.ok) graphStore.setError(result.error)
  })
}

/** 스태시 목록 패널 — 행 클릭은 그래프로 이동하고, 화살표는 파일 목록을 펼친다. */
export function StashPanel() {
  return (
    <Show when={stashPanelStore.panelOpen()}>
      <div class="worktree-panel stash-panel" classList={{ shifted: worktreeStore.panelOpen() }}>
        <div class="worktree-header stash-header">
          <span>Stashes ({stashPanelStore.stashes().length})</span>
          <span class="stash-header-actions">
            <button
              class="stash-header-btn"
              title={t('Stash working tree changes')}
              data-tip={t('Stash working tree changes')}
              aria-label={t('Stash working tree changes')}
              disabled={(graphStore.graph()?.uncommittedCount ?? 0) === 0}
              onClick={() => withReload(stashPush())}
            >
              <GitIcon name="add" size={16} />
            </button>
            <button
              class="stash-header-btn"
              title={t('Refresh stashes')}
              data-tip={t('Refresh stashes')}
              aria-label={t('Refresh stashes')}
              disabled={stashPanelStore.loading()}
              onClick={() => void stashPanelStore.reload()}
            >
              <GitIcon name="refresh" size={16} />
            </button>
            <button
              class="stash-header-btn"
              title={t('Close stash panel')}
              data-tip={t('Close stash panel')}
              onClick={stashPanelStore.closePanel}
              aria-label={t('Close stash panel')}
            >
              <GitIcon name="close" size={16} />
            </button>
          </span>
        </div>
        <div class="worktree-list stash-list">
          <Show
            when={!stashPanelStore.loading()}
            fallback={<div class="details-loading">Loading…</div>}
          >
            <For each={stashPanelStore.stashes()}>
              {(stash) => (
                <div class="stash-entry">
                  <div
                    class="worktree-item stash-item"
                    onClick={() => selectStash(stash)}
                    onContextMenu={(event) => openContextMenu(event, buildStashMenu(stash))}
                  >
                    <div class="stash-item-main">
                      <button
                        class="stash-expand"
                        classList={{ expanded: stashPanelStore.expanded().has(stash.selector) }}
                        title={t('Show changed files')}
                        aria-label={t('Show changed files')}
                        aria-expanded={stashPanelStore.expanded().has(stash.selector)}
                        onClick={stopAnd(() => void stashPanelStore.toggleExpanded(stash.selector))}
                      >
                        ▸
                      </button>
                      <span
                        class="stash-item-check"
                        classList={{ checked: stashPanelStore.selected().has(stash.selector) }}
                        title={t('Select for bulk actions')}
                        onClick={stopAnd(() => stashPanelStore.toggleSelected(stash.selector))}
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
                        {stash.message || stash.subject}
                      </span>
                      <span class="stash-inline-actions">
                        <button
                          class="stash-action-btn"
                          title={t('Apply stash')}
                          data-tip={t('Apply stash')}
                          aria-label={t('Apply stash')}
                          onClick={stopAnd(() => withReload(stashApply(stash.selector, false)))}
                        >
                          <GitIcon name="stash-apply" size={16} />
                        </button>
                        <button
                          class="stash-action-btn"
                          title={t('Pop stash')}
                          data-tip={t('Pop stash')}
                          aria-label={t('Pop stash')}
                          onClick={stopAnd(() => withReload(stashApply(stash.selector, true)))}
                        >
                          <GitIcon name="stash-pop" size={16} />
                        </button>
                        <button
                          class="stash-action-btn"
                          title={t('Compare stash')}
                          data-tip={t('Compare stash')}
                          aria-label={t('Compare stash')}
                          onClick={stopAnd(() => compareStash(stash))}
                        >
                          <GitIcon name="compare" size={16} />
                        </button>
                        <button
                          class="stash-action-btn danger"
                          title={t('Drop stash')}
                          data-tip={t('Drop stash')}
                          aria-label={t('Drop stash')}
                          onClick={stopAnd(() => withReload(stashDrop(stash.selector)))}
                        >
                          <GitIcon name="danger" size={16} />
                        </button>
                      </span>
                    </div>
                    <div class="stash-item-meta">
                      <Show when={stash.branch}>
                        {(branch) => <span class="stash-branch-badge">{branch()}</span>}
                      </Show>
                      <span class="stash-item-date" title={formatDate(stash.authorDate)}>
                        {formatRelativeTime(stash.authorDate, Date.now(), graphStore.settings().language)}
                      </span>
                    </div>
                  </div>
                  <Show when={stashPanelStore.expanded().has(stash.selector)}>
                    <div class="stash-files">
                      <Show
                        when={!stashPanelStore.filesLoading().has(stash.selector)}
                        fallback={<div class="stash-files-empty">Loading…</div>}
                      >
                        <Show
                          when={(stashPanelStore.filesFor(stash.selector) ?? []).length > 0}
                          fallback={<div class="stash-files-empty">{t('No changed files')}</div>}
                        >
                          <For each={stashPanelStore.filesFor(stash.selector) ?? []}>
                            {(file) => (
                              <button
                                class="stash-file"
                                title={file.oldPath ? `${file.oldPath} → ${file.path}` : file.path}
                                onClick={() => openStashDiff(file)}
                              >
                                <span class={`file-status status-${file.status}`}>{file.status}</span>
                                <span class="stash-file-path">
                                  {file.oldPath ? `${file.oldPath} → ${file.path}` : file.path}
                                </span>
                                <Show when={file.additions !== undefined}>
                                  <span class="file-linestat">
                                    <span class="file-added">+{file.additions}</span>
                                    {' / '}
                                    <span class="file-removed">-{file.deletions}</span>
                                  </span>
                                </Show>
                              </button>
                            )}
                          </For>
                        </Show>
                      </Show>
                    </div>
                  </Show>
                </div>
              )}
            </For>
            <Show when={stashPanelStore.stashes().length === 0}>
              <div class="branch-filter-empty">{t('No stashes')}</div>
            </Show>
          </Show>
        </div>
        <Show when={stashPanelStore.selected().size > 0}>
          <div class="worktree-footer">
            <button
              class="toolbar-btn danger"
              onClick={() => void stashPanelStore.dropSelected()}
              title={t('Drop all checked stashes')}
            >
              Drop Selected ({stashPanelStore.selected().size})
            </button>
          </div>
        </Show>
      </div>
    </Show>
  )
}
