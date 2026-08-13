import { onMount, Show } from 'solid-js'
import { graphStore } from '../entities/graph'
import { ContextMenuHost } from '../shared/ui'
import { CommitDetails } from '../widgets/commit-details'
import { GraphView } from '../widgets/graph-view'
import { Toolbar } from '../widgets/toolbar'

export function App() {
  onMount(() => void graphStore.loadRepos())

  return (
    <div class="app">
      <Toolbar />
      <Show when={graphStore.error()}>
        <div class="error-banner">
          <span class="error-text">{graphStore.error()}</span>
          <button class="error-dismiss" onClick={() => graphStore.setError(null)}>
            ✕
          </button>
        </div>
      </Show>
      <div class="main">
        <Show
          when={graphStore.repos().length > 0}
          fallback={<div class="empty-state">No git repository found in this workspace.</div>}
        >
          <GraphView />
        </Show>
      </div>
      <CommitDetails />
      <ContextMenuHost />
    </div>
  )
}
