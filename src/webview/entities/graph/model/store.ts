import { createMemo, createSignal } from 'solid-js'
import type { ActionResult, GraphData, RepoInfo } from '@shared-types/domain'
import type { WebviewSettings } from '@shared-types/messages'
import { initialSettings, onBridgeEvent, request } from '../../../shared/api'
import { layoutGraph } from '../lib/layout'

const [settings, setSettings] = createSignal<WebviewSettings>(initialSettings())
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
const [selectedCommit, setSelectedCommitRaw] = createSignal<string | null>(null)
/** Ctrl/Cmd+클릭으로 고른 비교 대상 커밋 (selectedCommit과 비교) */
const [compareWith, setCompareWith] = createSignal<string | null>(null)

function setSelectedCommit(hash: string | null): void {
  setSelectedCommitRaw(hash)
  setCompareWith(null)
}

onBridgeEvent((event) => {
  if (event.event === 'settings') setSettings(event.settings)
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

/**
 * git 액션 실행 공통 흐름: 성공하면 그래프를 갱신하고 true,
 * 실패하면 git stderr를 에러로 노출하고 false.
 */
async function runAction(
  action: Promise<ActionResult>,
  successMessage?: string,
): Promise<boolean> {
  try {
    const result = await action
    if (result.ok) {
      await refresh()
      if (successMessage) setNotice(successMessage)
      return true
    }
    setError(result.error)
    return false
  } catch (e) {
    setError(e instanceof Error ? e.message : String(e))
    return false
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
  selectedCommit,
  setSelectedCommit,
  compareWith,
  setCompareWith,
  loadRepos,
  refresh,
  loadMore,
  switchRepo,
  applyBranchFilter,
}
