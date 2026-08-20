import { createMemo, createRenderEffect, createSignal, For, Show } from 'solid-js'
import { graphStore } from '../../../entities/graph'
import { fetchAll, fetchDefault } from '../../../features/fetch'
import { resetHeadN } from '../../../features/reset'
import { searchStore } from '../../../features/search'
import { worktreeStore } from '../../../features/worktree'
import { makeMatcher } from '../../../shared/lib'
import { openContextMenu } from '../../../shared/ui'
import { branchLeafName, buildBranchTree, leafBranches } from '../lib/branchTree'
import type { BranchTreeFolder } from '../lib/branchTree'

/** 상단 툴바: 리포 선택, 브랜치 필터(glob), 검색(glob), reset, worktree, fetch, refresh */
export function Toolbar() {
  const [filterOpen, setFilterOpen] = createSignal(false)
  const [selected, setSelected] = createSignal<Set<string>>(new Set())
  const [branchGlob, setBranchGlob] = createSignal('')

  const branchNames = createMemo(() => {
    const refs = graphStore.graph()?.refs ?? []
    return refs.filter((r) => r.type === 'head' || r.type === 'remote').map((r) => r.name)
  })

  /** glob 입력이 있으면 목록을 즉석 필터링한다 (스펙 30-search-filter §30.4) */
  const visibleBranchNames = createMemo(() => {
    const pattern = branchGlob().trim()
    if (pattern === '') return branchNames()
    const matches = makeMatcher(pattern)
    return branchNames().filter(matches)
  })

  const applyFilter = () => {
    // 체크된 브랜치가 있으면 그것을, 없고 glob이 있으면 glob 일치 전체를 적용
    let names = [...selected()]
    if (names.length === 0 && branchGlob().trim() !== '') {
      names = visibleBranchNames()
    }
    void graphStore.applyBranchFilter(names.length === 0 ? null : names)
    setFilterOpen(false)
  }

  const clearFilter = () => {
    setSelected(new Set<string>())
    setBranchGlob('')
    void graphStore.applyBranchFilter(null)
    setFilterOpen(false)
  }

  const toggleBranch = (name: string) => {
    const next = new Set(selected())
    if (next.has(name)) next.delete(name)
    else next.add(name)
    setSelected(next)
  }

  // ── 트리 뷰 (스펙 30-search-filter §30.4.2) ──
  const [branchView, setBranchView] = createSignal<'list' | 'tree'>('list')
  /** 접힌 폴더 path 집합 — 기본은 모두 펼침 */
  const [collapsed, setCollapsed] = createSignal<Set<string>>(new Set())
  const branchTree = createMemo(() => buildBranchTree(visibleBranchNames()))

  const setMany = (names: string[], checked: boolean) => {
    const next = new Set(selected())
    for (const name of names) {
      if (checked) next.add(name)
      else next.delete(name)
    }
    setSelected(next)
  }

  const toggleCollapse = (path: string) => {
    const next = new Set(collapsed())
    if (next.has(path)) next.delete(path)
    else next.add(path)
    setCollapsed(next)
  }

  const BranchLeaf = (p: { name: string; depth: number }) => (
    <label
      class="branch-filter-item"
      style={{ 'padding-left': `${4 + p.depth * 14}px` }}
      title={p.name}
    >
      <input
        type="checkbox"
        checked={selected().has(p.name)}
        onChange={() => toggleBranch(p.name)}
      />
      {branchLeafName(p.name)}
    </label>
  )

  const BranchFolder = (p: { folder: BranchTreeFolder; depth: number }) => {
    const isCollapsed = () => collapsed().has(p.folder.path)
    const leaves = () => leafBranches(p.folder)
    const selectedCount = () => leaves().filter((name) => selected().has(name)).length
    return (
      <>
        <div
          class="branch-filter-item branch-tree-folder"
          style={{ 'padding-left': `${4 + p.depth * 14}px` }}
        >
          <span class="folder-arrow" onClick={() => toggleCollapse(p.folder.path)}>
            {isCollapsed() ? '▸' : '▾'}
          </span>
          <input
            type="checkbox"
            checked={leaves().length > 0 && selectedCount() === leaves().length}
            ref={(el) =>
              // 부분 선택 상태는 attribute가 아니라 property라 반응형 이펙트로 반영한다
              createRenderEffect(() => {
                el.indeterminate = selectedCount() > 0 && selectedCount() < leaves().length
              })
            }
            onChange={(e) => setMany(leaves(), e.currentTarget.checked)}
          />
          <span class="branch-tree-name" onClick={() => toggleCollapse(p.folder.path)}>
            {p.folder.name}
          </span>
        </div>
        <Show when={!isCollapsed()}>
          <For each={p.folder.folders}>
            {(child) => <BranchFolder folder={child} depth={p.depth + 1} />}
          </For>
          <For each={p.folder.branches}>
            {(name) => <BranchLeaf name={name} depth={p.depth + 1} />}
          </For>
        </Show>
      </>
    )
  }

  const openFetchMenu = (e: MouseEvent) => {
    openContextMenu(e, [
      { label: 'Fetch', onClick: () => void fetchAll(false) },
      {
        label: 'Fetch (prune) — 삭제된 원격 브랜치 참조 정리',
        onClick: () => void fetchAll(true),
      },
    ])
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
            <div class="branch-filter-glob">
              <input
                type="text"
                placeholder="glob 필터 (예: feature/*, release-[0-9]*)"
                value={branchGlob()}
                onInput={(e) => setBranchGlob(e.currentTarget.value)}
              />
            </div>
            <div class="branch-filter-head">
              <span class="branch-filter-count">{visibleBranchNames().length} branches</span>
              <span class="files-view-toggle">
                <button
                  class="toolbar-btn"
                  classList={{ primary: branchView() === 'tree' }}
                  title="Tree view"
                  onClick={() => setBranchView('tree')}
                >
                  Tree
                </button>
                <button
                  class="toolbar-btn"
                  classList={{ primary: branchView() === 'list' }}
                  title="Flat list"
                  onClick={() => setBranchView('list')}
                >
                  List
                </button>
              </span>
            </div>
            <div class="branch-filter-list">
              <Show
                when={branchView() === 'tree'}
                fallback={
                  <For each={visibleBranchNames()}>
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
                }
              >
                <For each={branchTree().folders}>
                  {(folder) => <BranchFolder folder={folder} depth={0} />}
                </For>
                <For each={branchTree().branches}>
                  {(name) => <BranchLeaf name={name} depth={0} />}
                </For>
              </Show>
              <Show when={visibleBranchNames().length === 0}>
                <div class="branch-filter-empty">일치하는 브랜치 없음</div>
              </Show>
            </div>
            <div class="branch-filter-actions">
              <button class="toolbar-btn" onClick={clearFilter}>
                Show All
              </button>
              <button class="toolbar-btn primary" onClick={applyFilter}>
                Apply
              </button>
            </div>
          </div>
        </Show>
      </div>

      <div class="search-box">
        <input
          type="text"
          placeholder="검색 (glob 지원: fix*, feat-?)"
          value={searchStore.query()}
          onInput={(e) => searchStore.search(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (e.shiftKey) searchStore.prev()
              else searchStore.next()
            }
            if (e.key === 'Escape') searchStore.search('')
          }}
        />
        <Show when={searchStore.query().trim() !== ''}>
          <span class="search-count">{searchStore.matchRows().length}</span>
          <button class="toolbar-btn" title="Previous match (Shift+Enter)" onClick={searchStore.prev}>
            ↑
          </button>
          <button class="toolbar-btn" title="Next match (Enter)" onClick={searchStore.next}>
            ↓
          </button>
        </Show>
      </div>

      <span class="toolbar-spacer" />

      <Show when={graphStore.graph()?.headBranch}>
        <span class="head-branch" title="checked out branch">
          ● {graphStore.graph()!.headBranch}
        </span>
      </Show>

      <button class="toolbar-btn" title="git reset --soft|mixed|hard HEAD~N" onClick={() => void resetHeadN()}>
        Reset…
      </button>
      <button
        class="toolbar-btn"
        title="Worktrees"
        classList={{ primary: worktreeStore.panelOpen() }}
        onClick={() => void worktreeStore.togglePanel()}
      >
        ⊕ Worktrees
      </button>
      <div class="split-btn">
        <button
          class="toolbar-btn"
          onClick={() => void fetchDefault()}
          onContextMenu={openFetchMenu}
          title="git fetch --all"
        >
          Fetch
        </button>
        <button
          class="toolbar-btn split-caret"
          onClick={openFetchMenu}
          title="fetch 옵션 — prune (삭제된 원격 브랜치 참조 정리)"
        >
          ▾
        </button>
      </div>
      <button class="toolbar-btn icon-btn" onClick={() => void graphStore.refresh()} title="Refresh">
        ⟳
      </button>
    </div>
  )
}
