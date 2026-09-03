import { createEffect, createMemo, createSignal, For, Show } from 'solid-js'
import { graphStore } from '../../../entities/graph'
import { authorStatsStore } from '../../../features/author-stats'
import { fetchAll, fetchDefault } from '../../../features/fetch'
import { pullCurrent } from '../../../features/pull'
import { resetHeadN } from '../../../features/reset'
import { stashPanelStore } from '../../../features/stash'
import { timelineStore } from '../../../features/timeline'
import { worktreeStore } from '../../../features/worktree'
import { makeMatcher, t } from '../../../shared/lib'
import { GitIcon } from '../../../shared/ui'
import { branchLeafName, buildBranchTree, leafBranches } from '../lib/branchTree'
import type { BranchTreeFolder } from '../lib/branchTree'

/** 상단 툴바 — [필터] · [상호작용 버튼] */
export function Toolbar() {
  let branchQueryInput: HTMLInputElement | undefined
  const [filterOpen, setFilterOpen] = createSignal(false)
  const [branchQuery, setBranchQuery] = createSignal('')
  const [branchView, setBranchView] = createSignal<'list' | 'tree'>('list')
  /** 접힌 폴더 path 집합 — 기본은 모두 펼침 (tree 뷰) */
  const [collapsed, setCollapsed] = createSignal<Set<string>>(new Set())

  createEffect(() => {
    if (!filterOpen()) return
    queueMicrotask(() => {
      if (!branchQueryInput?.isConnected) return
      branchQueryInput.focus()
      if (branchQueryInput.value !== '') branchQueryInput.select()
    })
  })

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

  const toggleAuthorStats = (): void => {
    if (!authorStatsStore.panelOpen()) {
      stashPanelStore.closePanel()
      worktreeStore.closePanel()
    }
    void authorStatsStore.togglePanel()
  }

  const toggleStashes = (): void => {
    if (!stashPanelStore.panelOpen()) authorStatsStore.closePanel()
    void stashPanelStore.togglePanel()
  }

  const toggleWorktrees = (): void => {
    if (!worktreeStore.panelOpen()) authorStatsStore.closePanel()
    void worktreeStore.togglePanel()
  }

  const faceLabel = () => {
    const filter = graphStore.branchFilter()
    if (!filter) return 'Show All'
    if (filter.length === 1) return filter[0]!
    return t('{0} branches', filter.length)
  }

  const pullTooltip = () => {
    const graph = graphStore.graph()
    if (!graph?.headBranch) return t('Cannot pull in detached HEAD state.')
    const upstream = graph.headUpstream
    return upstream
      ? t('Pull current branch from {0}', `${upstream.remote}/${upstream.branch}`)
      : t('Current branch has no upstream.')
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
                  ref={(element) => (branchQueryInput = element)}
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
                <div class="branch-filter-scope-toggles">
                  <span
                    class="toolbar-check"
                    classList={{ checked: graphStore.showRemotes() }}
                    title={t('Show remote branches in the graph')}
                    onClick={() => void graphStore.setShowRemotes(!graphStore.showRemotes())}
                  >
                    <span class="branch-option-check">✓</span>
                    {t('Show Remote Branches')}
                  </span>
                  <span
                    class="toolbar-check"
                    classList={{ checked: graphStore.hideRemoteOnlyBranches() }}
                    title={t('Hide remote branches without a local branch')}
                    onClick={() =>
                      void graphStore.setHideRemoteOnlyBranches(
                        !graphStore.hideRemoteOnlyBranches(),
                      )
                    }
                  >
                    <span class="branch-option-check">✓</span>
                    {t('Hide Remote-Only Branches')}
                  </span>
                </div>
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
              <Show when={graphStore.hiddenBranchNames().length > 0}>
                <div class="hidden-branches">
                  <div class="hidden-branches-head">
                    <span>{t('Hidden Branches ({0})', graphStore.hiddenBranchNames().length)}</span>
                    <button
                      class="hidden-branch-action"
                      onClick={() => void graphStore.clearHiddenBranches()}
                    >
                      {t('Unhide All')}
                    </button>
                  </div>
                  <For each={graphStore.hiddenBranchNames()}>
                    {(name) => (
                      <div class="hidden-branch-row" title={name}>
                        <span class="hidden-branch-name">{name}</span>
                        <button
                          class="hidden-branch-action"
                          aria-label={`${t('Unhide Branch')}: ${name}`}
                          onClick={() => void graphStore.unhideBranch(name)}
                        >
                          {t('Unhide Branch')}
                        </button>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
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

      </div>

      {/* 네이티브 title 툴팁이 webview에서 안 뜨는 환경이 있어 data-tip 커스텀 툴팁 사용 */}
      <div class="toolbar-section toolbar-right">
        <button
          class="toolbar-btn icon-btn timeline-toggle"
          data-tip={t('Toggle commit timeline')}
          aria-label={t('Toggle commit timeline')}
          aria-pressed={timelineStore.panelOpen()}
          onClick={() => timelineStore.togglePanel()}
        >
          <GitIcon name="timeline" size={15} />
        </button>
        <button
          class="toolbar-btn with-icon"
          data-tip={t('Open/close author statistics')}
          aria-label={t('Open/close author statistics')}
          classList={{ primary: authorStatsStore.panelOpen() }}
          onClick={toggleAuthorStats}
        >
          <GitIcon name="statistics" size={15} />
          <span>{t('Statistics')}</span>
        </button>
        <button
          class="toolbar-btn with-icon"
          data-tip={t('Reset HEAD by N commits')}
          aria-label={t('Reset HEAD by N commits')}
          onClick={() => void resetHeadN()}
        >
          <GitIcon name="reset" size={15} />
          <span>Reset…</span>
        </button>
        <button
          class="toolbar-btn with-icon"
          data-tip={t('Open/close the stash panel')}
          aria-label={t('Open/close the stash panel')}
          classList={{ primary: stashPanelStore.panelOpen() }}
          onClick={toggleStashes}
        >
          <GitIcon name="stash" size={15} />
          <span>{t('Stashes')}</span>
        </button>
        <button
          class="toolbar-btn with-icon"
          data-tip={t('Open/close the worktree panel')}
          aria-label={t('Open/close the worktree panel')}
          classList={{ primary: worktreeStore.panelOpen() }}
          onClick={toggleWorktrees}
        >
          <GitIcon name="worktree" size={15} />
          <span>{t('Worktrees')}</span>
        </button>
        <button
          class="toolbar-btn icon-btn toolbar-pull"
          data-tip={pullTooltip()}
          aria-label={pullTooltip()}
          disabled={!graphStore.graph()?.headUpstream}
          onClick={() => void pullCurrent()}
        >
          <GitIcon name="pull" size={15} />
        </button>
        <button
          class="toolbar-btn icon-btn toolbar-fetch"
          data-tip={t('Fetch — git fetch --all')}
          aria-label={t('Fetch — git fetch --all')}
          onClick={() => void fetchDefault()}
        >
          <GitIcon name="fetch" size={15} />
        </button>
        <button
          class="toolbar-btn icon-btn"
          data-tip={t('Fetch (prune) — clean up refs to branches deleted on the remote')}
          aria-label={t('Fetch (prune) — clean up refs to branches deleted on the remote')}
          onClick={() => void fetchAll(true)}
        >
          <GitIcon name="prune" size={15} />
        </button>
        <button
          class="toolbar-btn icon-btn"
          classList={{ spinning: graphStore.loading() }}
          data-tip={t('Refresh graph')}
          aria-label={t('Refresh graph')}
          onClick={() => void graphStore.refresh()}
        >
          <GitIcon name="refresh" size={15} />
        </button>
      </div>
    </div>
  )
}
