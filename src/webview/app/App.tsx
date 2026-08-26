import { onMount, Show } from 'solid-js'
import { graphStore } from '../entities/graph'
import { SearchWidget } from '../features/search'
import { ContextMenuHost, PromptHost } from '../shared/ui'
import { GraphView } from '../widgets/graph-view'
import { StashPanel } from '../widgets/stash-panel'
import { Toolbar } from '../widgets/toolbar'
import { WorktreePanel } from '../widgets/worktree-panel'

export function App() {
  onMount(() => void graphStore.loadRepos())

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
            <GraphView />
          </>
        </Show>
      </div>
      <WorktreePanel />
      <StashPanel />
      <ContextMenuHost />
      <PromptHost />
    </div>
  )
}
