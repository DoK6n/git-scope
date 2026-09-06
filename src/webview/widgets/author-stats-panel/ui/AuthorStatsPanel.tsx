import { createEffect, createMemo, For, on, Show } from 'solid-js'
import type { AuthorStatsPeriod, AuthorStatsScope } from '@shared-types/domain'
import { AuthorAvatar } from '../../../entities/author'
import { graphStore } from '../../../entities/graph'
import { authorStatsStore } from '../../../features/author-stats'
import { t } from '../../../shared/lib'

export function AuthorStatsPanel() {
  const totalCommits = createMemo(() =>
    authorStatsStore.authors().reduce((total, author) => total + author.commits, 0),
  )

  createEffect(
    on(
      graphStore.currentRepo,
      () => {
        if (authorStatsStore.panelOpen()) void authorStatsStore.reload()
      },
      { defer: true },
    ),
  )

  return (
    <Show when={authorStatsStore.panelOpen()}>
      <section class="worktree-panel author-stats-panel" aria-label={t('Author statistics')}>
        <div class="worktree-header">
          <span>{t('Author Statistics')}</span>
          <button
            class="details-close"
            style={{ position: 'static' }}
            onClick={authorStatsStore.closePanel}
            aria-label={t('Close author statistics')}
          >
            ✕
          </button>
        </div>
        <div class="author-stats-controls">
          <label>
            <span>{t('Scope')}</span>
            <select
              value={authorStatsStore.scope()}
              onChange={(event) =>
                void authorStatsStore.setScope(event.currentTarget.value as AuthorStatsScope)
              }
            >
              <option value="currentBranch">{t('Current branch')}</option>
              <option value="allRefs">{t('All refs')}</option>
            </select>
          </label>
          <label>
            <span>{t('Period')}</span>
            <select
              value={authorStatsStore.period()}
              onChange={(event) =>
                void authorStatsStore.setPeriod(event.currentTarget.value as AuthorStatsPeriod)
              }
            >
              <option value="all">{t('All time')}</option>
              <option value="30d">{t('Last 30 days')}</option>
              <option value="90d">{t('Last 90 days')}</option>
              <option value="365d">{t('Last 365 days')}</option>
            </select>
          </label>
          <p>{t('Counts the complete Git history for this scope, not the loaded graph rows.')}</p>
        </div>
        <div class="worktree-list author-stats-list">
          <Show when={!authorStatsStore.loading()} fallback={<div class="details-loading">{t('Loading…')}</div>}>
            <Show when={authorStatsStore.error()}>
              {(message) => <div class="author-stats-error">{message()}</div>}
            </Show>
            <Show when={!authorStatsStore.error() && authorStatsStore.authors().length === 0}>
              <div class="branch-filter-empty">{t('No commits in this range')}</div>
            </Show>
            <For each={authorStatsStore.authors()}>
              {(author) => (
                <div class="author-stats-item">
                  <AuthorAvatar
                    repo={graphStore.currentRepo() ?? ''}
                    name={author.name}
                    email={author.email}
                    commitHash={author.commitHash}
                    size={28}
                  />
                  <span class="author-stats-identity">
                    <strong>{author.name}</strong>
                    <span title={author.email}>{author.email}</span>
                  </span>
                  <span class="author-stats-count">
                    {author.commits} {t(author.commits === 1 ? 'commit' : 'commits')}
                  </span>
                </div>
              )}
            </For>
          </Show>
        </div>
        <div class="worktree-footer author-stats-footer">
          <span>{t('{0} authors · {1} commits', authorStatsStore.authors().length, totalCommits())}</span>
          <button class="toolbar-btn" onClick={() => void authorStatsStore.reload()}>
            {t('Refresh')}
          </button>
        </div>
      </section>
    </Show>
  )
}
