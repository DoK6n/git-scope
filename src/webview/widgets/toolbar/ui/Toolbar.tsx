import { createMemo, createSignal, For, Show } from 'solid-js'
import { graphStore } from '../../../entities/graph'
import { request } from '../../../shared/api'

/** 상단 툴바: 리포 선택, 브랜치 필터, fetch, refresh */
export function Toolbar() {
  const [filterOpen, setFilterOpen] = createSignal(false)
  const [selected, setSelected] = createSignal<Set<string>>(new Set())

  const branchNames = createMemo(() => {
    const refs = graphStore.graph()?.refs ?? []
    return refs.filter((r) => r.type === 'head' || r.type === 'remote').map((r) => r.name)
  })

  const applyFilter = () => {
    const names = [...selected()]
    void graphStore.applyBranchFilter(names.length === 0 ? null : names)
    setFilterOpen(false)
  }

  const toggleBranch = (name: string) => {
    const next = new Set(selected())
    if (next.has(name)) next.delete(name)
    else next.add(name)
    setSelected(next)
  }

  const doFetch = async () => {
    await graphStore.runAction(
      request('fetch', {
        repo: graphStore.currentRepo()!,
        prune: graphStore.settings().fetchPruneByDefault,
      }),
    )
  }

  return (
    <div class="toolbar">
      <Show when={graphStore.repos().length > 1}>
        <select
          class="repo-select"
          onChange={(e) => void graphStore.switchRepo(e.currentTarget.value)}
        >
          <For each={graphStore.repos()}>
            {(repo) => (
              <option value={repo.root} selected={repo.root === graphStore.currentRepo()}>
                {repo.name}
              </option>
            )}
          </For>
        </select>
      </Show>

      <div class="branch-filter">
        <button class="toolbar-btn" onClick={() => setFilterOpen(!filterOpen())}>
          Branches{graphStore.branchFilter() ? ` (${graphStore.branchFilter()!.length})` : ''} ▾
        </button>
        <Show when={filterOpen()}>
          <div class="branch-filter-dropdown">
            <div class="branch-filter-list">
              <For each={branchNames()}>
                {(name) => (
                  <label class="branch-filter-item">
                    <input
                      type="checkbox"
                      checked={selected().has(name)}
                      onChange={() => toggleBranch(name)}
                    />
                    {name}
                  </label>
                )}
              </For>
            </div>
            <div class="branch-filter-actions">
              <button class="toolbar-btn" onClick={() => setSelected(new Set<string>())}>
                Clear
              </button>
              <button class="toolbar-btn primary" onClick={applyFilter}>
                Apply
              </button>
            </div>
          </div>
        </Show>
      </div>

      <span class="toolbar-spacer" />

      <Show when={graphStore.graph()?.headBranch}>
        <span class="head-branch" title="checked out branch">
          ● {graphStore.graph()!.headBranch}
        </span>
      </Show>

      <button class="toolbar-btn" onClick={() => void doFetch()} title="git fetch --all">
        Fetch
      </button>
      <button class="toolbar-btn" onClick={() => void graphStore.refresh()} title="Refresh">
        ⟳
      </button>
    </div>
  )
}
