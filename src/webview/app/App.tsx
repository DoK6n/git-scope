import { createEffect, onMount, Show } from 'solid-js'
import { graphStore } from '../entities/graph'
import { SearchWidget } from '../features/search'
import { timelineStore } from '../features/timeline'
import { ContextMenuHost, PromptHost } from '../shared/ui'
import { AuthorStatsPanel } from '../widgets/author-stats-panel'
import { GraphView } from '../widgets/graph-view'
import { StashPanel } from '../widgets/stash-panel'
import { Toolbar } from '../widgets/toolbar'
import { TimelineView } from '../widgets/timeline-view'
import { WorktreePanel } from '../widgets/worktree-panel'

export function App() {
  let timelineRepo = graphStore.currentRepo()

  createEffect(() => {
    const repo = graphStore.currentRepo()
    if (repo !== timelineRepo) {
      timelineStore.clearDateFilter()
      timelineStore.setSelectedAuthor(null)
      timelineRepo = repo
    }
  })

  // 에디터 blame에서 패널을 연 경우 저장소 목록을 읽은 뒤 요청한 커밋으로 이동한다
  onMount(() => void graphStore.loadRepos().then(() => graphStore.consumeRevealRequest()))

  return (
    <div class="app">
      <Toolbar />
      <div class="main">
        <Show
          when={graphStore.repos().length > 0}
          fallback={<div class="empty-state">No git repository found in this workspace.</div>}
        >
          <>
            <SearchWidget />
            <Show when={timelineStore.panelOpen()}>
              <TimelineView />
            </Show>
            <GraphView />
          </>
        </Show>
      </div>
      <WorktreePanel />
      <StashPanel />
      <AuthorStatsPanel />
      <ContextMenuHost />
      <PromptHost />
    </div>
  )
}
