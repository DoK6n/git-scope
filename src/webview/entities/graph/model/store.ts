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
const [error, setError] = createSignal<string | null>(null)
const [notice, setNoticeRaw] = createSignal<string | null>(null)

let noticeTimer: ReturnType<typeof setTimeout> | undefined
/** 액션 성공 토스트 — 4초 후 자동 사라짐 */
function setNotice(message: string | null): void {
  if (noticeTimer !== undefined) clearTimeout(noticeTimer)
  setNoticeRaw(message)
  if (message !== null) {
    noticeTimer = setTimeout(() => setNoticeRaw(null), 4000)
  }
}
const [maxCommits, setMaxCommits] = createSignal(initialSettings().initialLoadCommits)
/** null = 모든 브랜치, 아니면 선택된 ref 이름 목록 */
const [branchFilter, setBranchFilter] = createSignal<string[] | null>(null)
const [selectedCommit, setSelectedCommit] = createSignal<string | null>(null)

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
  loadRepos,
  refresh,
  loadMore,
  switchRepo,
  applyBranchFilter,
}
