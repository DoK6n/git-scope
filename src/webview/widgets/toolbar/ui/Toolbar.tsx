import { createMemo, createSignal, For, Show } from 'solid-js'
import { graphStore } from '../../../entities/graph'
import { fetchAll, fetchDefault } from '../../../features/fetch'
import { resetHeadN } from '../../../features/reset'
import { stashPanelStore } from '../../../features/stash'
import { worktreeStore } from '../../../features/worktree'
import { makeMatcher, t } from '../../../shared/lib'
import { branchLeafName, buildBranchTree, leafBranches } from '../lib/branchTree'
import type { BranchTreeFolder } from '../lib/branchTree'

/** fetch 버튼 글리프 — 구름 + 아래 화살표 (자체 제작) */
function FetchGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15">
      <path
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        d="M5.2 11.5 H4.1 A2.6 2.6 0 0 1 3.9 6.3 A4.1 4.1 0 0 1 11.9 5.2 A2.9 2.9 0 0 1 11.6 11.5 H10.8"
      />
      <path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" d="M8 7.2 v5.4" />
      <path fill="currentColor" d="M8 15 L5.7 12.4 h4.6 z" />
    </svg>
  )
}

/** fetch --prune 글리프 — 가위 (죽은 가지치기 메타포, 자체 제작) */
function PruneGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15">
      <g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
        <circle cx="3.6" cy="4.1" r="1.9" />
        <circle cx="3.6" cy="11.9" r="1.9" />
        <path d="M5.3 5 L13.8 12.6" />
        <path d="M5.3 11 L13.8 3.4" />
      </g>
    </svg>
  )
}

/** 새로고침 글리프 — 원형 화살표 (자체 제작). 로딩 중이면 회전 */
function RefreshGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15">
      <path
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
        d="M13.2 8 A5.2 5.2 0 1 1 11.7 4.4"
      />
      <path fill="currentColor" d="M14.2 1.6 v4.8 h-4.8 z" />
    </svg>
  )
}

/** 상단 툴바 — [필터] · [상호작용 버튼] */
export function Toolbar() {
  const [filterOpen, setFilterOpen] = createSignal(false)
  const [branchQuery, setBranchQuery] = createSignal('')
  const [branchView, setBranchView] = createSignal<'list' | 'tree'>('list')
  /** 접힌 폴더 path 집합 — 기본은 모두 펼침 (tree 뷰) */
  const [collapsed, setCollapsed] = createSignal<Set<string>>(new Set())

  /** 선택 집합 = branchFilter 그대로 — 드롭다운은 상태를 따로 들고 있지 않는다 */
  const selected = createMemo(() => new Set(graphStore.branchFilter() ?? []))

  const matcher = createMemo(() => {
    const query = branchQuery().trim()
    return query === '' ? null : makeMatcher(query)
  })
  const visible = (names: string[]) => {
    const match = matcher()
    return match ? names.filter(match) : names
  }

  const localBranches = createMemo(() =>
    (graphStore.graph()?.refs ?? []).filter((r) => r.type === 'head').map((r) => r.name),
  )

  /** 원격별 브랜치 그룹 — origin/HEAD 심볼릭 참조는 필터 대상이 아니므로 제외 */
  const remoteGroups = createMemo(() => {
    const groups = new Map<string, string[]>()
    for (const ref of graphStore.graph()?.refs ?? []) {
      if (ref.type !== 'remote' || !ref.remote || ref.name === `${ref.remote}/HEAD`) continue
      const list = groups.get(ref.remote)
      if (list) list.push(ref.name)
      else groups.set(ref.remote, [ref.name])
    }
    return [...groups.entries()]
  })

  const visibleCount = createMemo(() => {
    let count = visible(localBranches()).length
    for (const [, names] of remoteGroups()) count += visible(names).length
    return count
  })

  /** tree 뷰 — list처럼 로컬 트리와 원격별 트리를 분리한다 (원격은 접두를 떼고 트리 구성) */
  const localTree = createMemo(() => buildBranchTree(visible(localBranches())))
  const remoteTrees = createMemo(() =>
    remoteGroups().map(
      ([remote, names]) =>
        [
          remote,
          buildBranchTree(visible(names).map((name) => name.slice(remote.length + 1))),
        ] as const,
    ),
  )
  const treeHasContent = (tree: BranchTreeFolder) =>
    tree.folders.length > 0 || tree.branches.length > 0

  /** 체크 토글 즉시 적용 — 선택이 모두 풀리면 Show All로 돌아간다 */
  const applySelected = (next: Set<string>) => {
    void graphStore.applyBranchFilter(next.size === 0 ? null : [...next])
  }

  const toggleBranch = (name: string) => {
    const next = new Set(selected())
    if (next.has(name)) next.delete(name)
    else next.add(name)
    applySelected(next)
  }

  const setMany = (names: string[], checked: boolean) => {
    const next = new Set(selected())
    for (const name of names) {
      if (checked) next.add(name)
      else next.delete(name)
    }
    applySelected(next)
  }

  const showAll = () => {
    void graphStore.applyBranchFilter(null)
    setFilterOpen(false)
  }

  const faceLabel = () => {
    const filter = graphStore.branchFilter()
    if (!filter) return 'Show All'
    if (filter.length === 1) return filter[0]!
    return t('{0} branches', filter.length)
  }

  const OptionRow = (p: {
    checked: boolean
    label: string
    title?: string
    onClick: () => void
  }) => (
    <div
      class="branch-option"
      classList={{ checked: p.checked }}
      title={p.title ?? p.label}
      onClick={() => p.onClick()}
    >
      <span class="branch-option-check">✓</span>
      <span class="branch-option-label">{p.label}</span>
    </div>
  )

  const toggleCollapse = (path: string) => {
    const next = new Set(collapsed())
    if (next.has(path)) next.delete(path)
    else next.add(path)
    setCollapsed(next)
  }

  /** prefix: 원격 트리에서 접두를 뗀 표시명 → 전체 ref 이름 복원용 (예: "origin/") */
  const BranchLeaf = (p: { name: string; depth: number; prefix?: string }) => {
    const fullName = () => (p.prefix ?? '') + p.name
    return (
      <div
        class="branch-option branch-tree-row"
        classList={{ checked: selected().has(fullName()) }}
        style={{ 'padding-left': `${8 + p.depth * 14}px` }}
        title={fullName()}
        onClick={() => toggleBranch(fullName())}
      >
        <span class="branch-option-check">✓</span>
        <span class="branch-option-label">{branchLeafName(p.name)}</span>
      </div>
    )
  }

  const BranchFolder = (p: { folder: BranchTreeFolder; depth: number; prefix?: string }) => {
    const isCollapsed = () => collapsed().has((p.prefix ?? '') + p.folder.path)
    const leaves = () => leafBranches(p.folder).map((name) => (p.prefix ?? '') + name)
    const selectedCount = () => leaves().filter((name) => selected().has(name)).length
    const allSelected = () => leaves().length > 0 && selectedCount() === leaves().length
    const partial = () => selectedCount() > 0 && !allSelected()
    return (
      <>
        <div
          class="branch-option branch-tree-row branch-tree-folder"
          style={{ 'padding-left': `${8 + p.depth * 14}px` }}
        >
          <span
            class="folder-arrow"
            onClick={() => toggleCollapse((p.prefix ?? '') + p.folder.path)}
          >
            {isCollapsed() ? '▸' : '▾'}
          </span>
          <span
            class="branch-option-check"
            classList={{ checked: allSelected(), partial: partial() }}
            title={t('Select/unselect all branches under this folder')}
            onClick={() => setMany(leaves(), !allSelected())}
          >
            {partial() ? '–' : '✓'}
          </span>
          <span
            class="branch-tree-name"
            onClick={() => toggleCollapse((p.prefix ?? '') + p.folder.path)}
          >
            {p.folder.name}
          </span>
        </div>
        <Show when={!isCollapsed()}>
          <For each={p.folder.folders}>
            {(child) => <BranchFolder folder={child} depth={p.depth + 1} prefix={p.prefix} />}
          </For>
          <For each={p.folder.branches}>
            {(name) => <BranchLeaf name={name} depth={p.depth + 1} prefix={p.prefix} />}
          </For>
        </Show>
      </>
    )
  }

  return (
    <div class="toolbar">
      <div class="toolbar-section toolbar-left">
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
          <button
            class="branch-select"
            classList={{ open: filterOpen() }}
            title={t('Select branches to show in the graph')}
            onClick={() => setFilterOpen(!filterOpen())}
          >
            <span class="branch-select-value">{faceLabel()}</span>
            <span class="branch-select-caret">{filterOpen() ? '▴' : '▾'}</span>
          </button>
          <Show when={filterOpen()}>
            <div class="dropdown-overlay" onClick={() => setFilterOpen(false)} />
            <div class="branch-filter-dropdown">
              <div class="branch-filter-glob">
                <input
                  type="text"
                  placeholder={t('Filter Branches… (glob: feature/*)')}
                  value={branchQuery()}
                  onInput={(e) => setBranchQuery(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setFilterOpen(false)
                  }}
                />
              </div>
              <div class="branch-filter-head">
                <span
                  class="toolbar-check"
                  classList={{ checked: graphStore.showRemotes() }}
                  title={t('Show remote branches in the graph')}
                  onClick={() => void graphStore.setShowRemotes(!graphStore.showRemotes())}
                >
                  <span class="branch-option-check">✓</span>
                  Show Remote Branches
                </span>
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
                <OptionRow
                  checked={graphStore.branchFilter() === null}
                  label="Show All"
                  onClick={showAll}
                />
                <Show
                  when={branchView() === 'tree'}
                  fallback={
                    <>
                      <Show when={visible(localBranches()).length > 0}>
                        <div class="branch-filter-divider" />
                        <For each={visible(localBranches())}>
                          {(name) => (
                            <OptionRow
                              checked={selected().has(name)}
                              label={name}
                              onClick={() => toggleBranch(name)}
                            />
                          )}
                        </For>
                      </Show>
                      <For each={remoteGroups()}>
                        {([remote, names]) => (
                          <Show when={visible(names).length > 0}>
                            <div class="branch-filter-divider" />
                            <div class="branch-filter-group">{remote}</div>
                            <For each={visible(names)}>
                              {(name) => (
                                <OptionRow
                                  checked={selected().has(name)}
                                  label={name.slice(remote.length + 1)}
                                  title={name}
                                  onClick={() => toggleBranch(name)}
                                />
                              )}
                            </For>
                          </Show>
                        )}
                      </For>
                    </>
                  }
                >
                  <Show when={treeHasContent(localTree())}>
                    <div class="branch-filter-divider" />
                    <For each={localTree().folders}>
                      {(folder) => <BranchFolder folder={folder} depth={0} />}
                    </For>
                    <For each={localTree().branches}>
                      {(name) => <BranchLeaf name={name} depth={0} />}
                    </For>
                  </Show>
                  <For each={remoteTrees()}>
                    {([remote, tree]) => (
                      <Show when={treeHasContent(tree)}>
                        <div class="branch-filter-divider" />
                        <div class="branch-filter-group">{remote}</div>
                        <For each={tree.folders}>
                          {(folder) => (
                            <BranchFolder folder={folder} depth={0} prefix={`${remote}/`} />
                          )}
                        </For>
                        <For each={tree.branches}>
                          {(name) => <BranchLeaf name={name} depth={0} prefix={`${remote}/`} />}
                        </For>
                      </Show>
                    )}
                  </For>
                </Show>
                <Show when={visibleCount() === 0}>
                  <div class="branch-filter-empty">{t('No matching branches')}</div>
                </Show>
              </div>
            </div>
          </Show>
        </div>

        <Show when={graphStore.graph()?.headBranch}>
          <span class="head-branch" title="checked out branch">
            ● {graphStore.graph()!.headBranch}
          </span>
        </Show>
      </div>

      {/* 네이티브 title 툴팁이 webview에서 안 뜨는 환경이 있어 data-tip 커스텀 툴팁 사용 */}
      <div class="toolbar-section toolbar-right">
        <button
          class="toolbar-btn"
          data-tip="git reset --soft|mixed|hard HEAD~N"
          onClick={() => void resetHeadN()}
        >
          Reset…
        </button>
        <button
          class="toolbar-btn"
          data-tip={t('Open/close the stash panel')}
          classList={{ primary: stashPanelStore.panelOpen() }}
          onClick={() => void stashPanelStore.togglePanel()}
        >
          ▤ Stashes
        </button>
        <button
          class="toolbar-btn"
          data-tip={t('Open/close the worktree panel')}
          classList={{ primary: worktreeStore.panelOpen() }}
          onClick={() => void worktreeStore.togglePanel()}
        >
          ⊕ Worktrees
        </button>
        <button
          class="toolbar-btn icon-btn"
          data-tip={t('Fetch — git fetch --all')}
          onClick={() => void fetchDefault()}
        >
          <FetchGlyph />
        </button>
        <button
          class="toolbar-btn icon-btn"
          data-tip={t('Fetch (prune) — clean up refs to branches deleted on the remote')}
          onClick={() => void fetchAll(true)}
        >
          <PruneGlyph />
        </button>
        <button
          class="toolbar-btn icon-btn"
          classList={{ spinning: graphStore.loading() }}
          data-tip="Refresh"
          onClick={() => void graphStore.refresh()}
        >
          <RefreshGlyph />
        </button>
      </div>
    </div>
  )
}
