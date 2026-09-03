import { createMemo, createSignal } from 'solid-js'
import type { ActionResult, GraphData, RepoInfo } from '@shared-types/domain'
import type { WebviewSettings } from '@shared-types/messages'
import { initialSettings, onBridgeEvent, request } from '../../../shared/api'
import { setLocale, t } from '../../../shared/lib'
import { errorDialog } from '../../../shared/ui'
import { layoutGraph } from '../lib/layout'

const [settings, setSettings] = createSignal<WebviewSettings>(initialSettings())
setLocale(initialSettings().language ?? 'en')
const [repos, setRepos] = createSignal<RepoInfo[]>([])
const [currentRepo, setCurrentRepo] = createSignal<string | null>(null)
const [graph, setGraph] = createSignal<GraphData | null>(null)
const [loading, setLoading] = createSignal(false)
const [error, setErrorRaw] = createSignal<string | null>(null)

/** 에러 알림 — IDE 네이티브 에러 알림으로 표시 (git stderr 그대로) */
function setError(message: string | null): void {
  setErrorRaw(message)
  if (message !== null) {
    void request('notify', { message, level: 'error' }).catch(() => {})
  }
}
const [notice, setNoticeRaw] = createSignal<string | null>(null)

/** 액션 성공 알림 — IDE 네이티브 알림으로 표시 (webview 배너 없음) */
function setNotice(message: string | null): void {
  setNoticeRaw(message)
  if (message !== null) {
    void request('notify', { message, level: 'info' }).catch(() => {})
  }
}
const [maxCommits, setMaxCommits] = createSignal(initialSettings().initialLoadCommits)
/** null = 모든 브랜치, 아니면 선택된 ref 이름 목록 */
const [branchFilter, setBranchFilter] = createSignal<string[] | null>(null)
/** 원격 브랜치 표시 여부 — 끄면 로그·뱃지·드롭다운에서 원격 참조 제외 */
const [showRemotes, setShowRemotesRaw] = createSignal(true)
/** 대응 로컬 브랜치가 없는 원격 브랜치 숨김 — webview 세션 동안 저장소 전환 후에도 유지 */
const [hideRemoteOnlyBranches, setHideRemoteOnlyBranchesRaw] = createSignal(false)
/** 수동 숨김은 이름 충돌을 피하도록 저장소별 세션 blocklist로 보관한다. */
const [manuallyHiddenBranchNamesByRepo, setManuallyHiddenBranchNamesByRepo] = createSignal<
  Record<string, string[]>
>({})
const hiddenBranchNames = createMemo(() => {
  const repo = currentRepo()
  return repo === null ? [] : (manuallyHiddenBranchNamesByRepo()[repo] ?? [])
})
const [selectedCommit, setSelectedCommitRaw] = createSignal<string | null>(null)
/** Ctrl/Cmd+클릭으로 고른 비교 대상 커밋 (selectedCommit과 비교) */
const [compareWith, setCompareWith] = createSignal<string | null>(null)

function setSelectedCommit(hash: string | null): void {
  setSelectedCommitRaw(hash)
  setCompareWith(null)
}

/** GraphView가 소비하는 스크롤 타겟 행 (검색 외 진입점용 — 스태시 패널 등) */
const [scrollTargetRow, setScrollTargetRow] = createSignal<number | null>(null)

/**
 * 해시의 커밋 행으로 스크롤 요청.
 * 로드된 범위 밖이면 커밋을 추가 로드하며 찾은 뒤 이동한다 (안전 상한 20회).
 */
async function scrollToHash(hash: string): Promise<void> {
  const find = () => (graph()?.commits ?? []).findIndex((c) => c.hash === hash)
  let index = find()
  let rounds = 0
  while (index < 0 && graph()?.moreAvailable && rounds < 20) {
    const before = graph()?.commits.length ?? 0
    await loadMore()
    // 로드가 진행되지 않았으면(이미 로딩 중 등) 무한 루프 방지를 위해 중단
    if ((graph()?.commits.length ?? 0) === before) break
    index = find()
    rounds++
  }
  if (index < 0) {
    setNotice(t('Commit not found in the graph.'))
    return
  }
  setScrollTargetRow(index)
}

onBridgeEvent((event) => {
  if (event.event === 'settings') {
    setSettings(event.settings)
    setLocale(event.settings.language ?? 'en')
  }
  if (event.event === 'repoChanged') void refresh()
})

/** 그래프 레이아웃 — 커밋 목록이 바뀔 때만 재계산 */
const layout = createMemo(() => {
  const data = graph()
  if (!data) return null
  return layoutGraph(data.commits, data.moreAvailable)
})

async function loadRepos(): Promise<void> {
  try {
    const list = await request('listRepos', {})
    setRepos(list)
    if (currentRepo() === null && list.length > 0) {
      setCurrentRepo(list[0]!.root)
      await refresh()
    }
  } catch (e) {
    setError(e instanceof Error ? e.message : String(e))
  }
}

async function refresh(): Promise<void> {
  const repo = currentRepo()
  if (repo === null) return
  setLoading(true)
  try {
    const data = await request('getGraph', {
      repo,
      maxCommits: maxCommits(),
      branches: branchFilter(),
      includeRemotes: showRemotes(),
      hideRemoteOnlyBranches: hideRemoteOnlyBranches(),
      hiddenBranchNames: hiddenBranchNames(),
    })
    setGraph(data)
    setError(null)
  } catch (e) {
    setError(e instanceof Error ? e.message : String(e))
  } finally {
    setLoading(false)
  }
}

/** 스크롤 바닥에서 추가 커밋 로드 */
async function loadMore(): Promise<void> {
  const data = graph()
  if (!data || !data.moreAvailable || loading()) return
  setMaxCommits((n) => n + settings().loadMoreCommits)
  await refresh()
}

async function switchRepo(root: string): Promise<void> {
  setCurrentRepo(root)
  setMaxCommits(settings().initialLoadCommits)
  setBranchFilter(null)
  setSelectedCommit(null)
  await refresh()
}

async function applyBranchFilter(refs: string[] | null): Promise<void> {
  setBranchFilter(refs)
  setMaxCommits(settings().initialLoadCommits)
  await refresh()
}

async function updateHiddenBranches(update: (current: string[]) => string[]): Promise<void> {
  const repo = currentRepo()
  if (repo === null) return
  setManuallyHiddenBranchNamesByRepo((byRepo) => ({
    ...byRepo,
    [repo]: update(byRepo[repo] ?? []),
  }))
  setMaxCommits(settings().initialLoadCommits)
  await refresh()
}

async function hideBranch(name: string): Promise<void> {
  if (hiddenBranchNames().includes(name)) return
  await updateHiddenBranches((current) => [...current, name].sort())
}

async function unhideBranch(name: string): Promise<void> {
  await updateHiddenBranches((current) => current.filter((branch) => branch !== name))
}

async function clearHiddenBranches(): Promise<void> {
  if (hiddenBranchNames().length === 0) return
  await updateHiddenBranches(() => [])
}

/** 원격 브랜치 표시 토글 — 끌 때 필터에 남아 있는 원격 선택도 함께 제거 */
async function setShowRemotes(show: boolean): Promise<void> {
  if (show === showRemotes()) return
  if (!show) {
    const current = branchFilter()
    if (current) {
      const remoteNames = new Set(
        (graph()?.refs ?? []).filter((r) => r.type === 'remote').map((r) => r.name),
      )
      const next = current.filter((name) => !remoteNames.has(name))
      setBranchFilter(next.length === 0 ? null : next)
    }
  }
  setShowRemotesRaw(show)
  await refresh()
}

/** 원격 전용 브랜치 숨김 토글 — 숨겨지는 ref만 기존 allowlist에서 제거한다. */
async function setHideRemoteOnlyBranches(hide: boolean): Promise<void> {
  if (hide === hideRemoteOnlyBranches()) return
  if (hide) {
    const refs = graph()?.refs ?? []
    const localBranches = new Set(
      refs.filter((ref) => ref.type === 'head').map((ref) => ref.name),
    )
    const remoteOnly = new Set(
      refs
        .filter(
          (ref) =>
            ref.type === 'remote' &&
            ref.remote !== undefined &&
            ref.name !== `${ref.remote}/HEAD` &&
            !localBranches.has(ref.name.slice(ref.remote.length + 1)),
        )
        .map((ref) => ref.name),
    )
    const current = branchFilter()
    if (current) {
      const next = current.filter((name) => !remoteOnly.has(name))
      setBranchFilter(next.length === 0 ? null : next)
    }
  }
  setHideRemoteOnlyBranchesRaw(hide)
  await refresh()
}

/**
 * git 액션 실행 공통 흐름: 성공하면 그래프를 갱신하고 true,
 * 실패하면 git stderr를 에러로 노출하고 false.
 * errorTitle을 주면 IDE 알림 대신 webview 에러 다이얼로그로 보여준다.
 */
async function runAction(
  action: Promise<ActionResult>,
  successMessage?: string,
  errorTitle?: string,
  refreshOnFailure = false,
): Promise<boolean> {
  const fail = (message: string): false => {
    if (errorTitle) {
      setErrorRaw(message)
      void errorDialog({ title: errorTitle, message })
    } else {
      setError(message)
    }
    return false
  }
  try {
    const result = await action
    if (result.ok) {
      await refresh()
      if (successMessage) setNotice(successMessage)
      return true
    }
    if (refreshOnFailure) await refresh()
    return fail(result.error)
  } catch (e) {
    if (refreshOnFailure) await refresh()
    return fail(e instanceof Error ? e.message : String(e))
  }
}

export const graphStore = {
  runAction,
  notice,
  setNotice,
  settings,
  repos,
  currentRepo,
  graph,
  layout,
  loading,
  error,
  setError,
  branchFilter,
  hiddenBranchNames,
  hideBranch,
  unhideBranch,
  clearHiddenBranches,
  showRemotes,
  setShowRemotes,
  hideRemoteOnlyBranches,
  setHideRemoteOnlyBranches,
  selectedCommit,
  setSelectedCommit,
  compareWith,
  setCompareWith,
  scrollTargetRow,
  consumeScrollTarget: () => setScrollTargetRow(null),
  scrollToHash,
  loadRepos,
  refresh,
  loadMore,
  switchRepo,
  applyBranchFilter,
}
