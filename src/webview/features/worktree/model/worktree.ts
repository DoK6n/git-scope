import { createSignal } from 'solid-js'
import type { Worktree } from '@shared-types/domain'
import { graphStore } from '../../../entities/graph'
import { request } from '../../../shared/api'
import { confirmDialog, formDialog } from '../../../shared/ui'

const [panelOpen, setPanelOpen] = createSignal(false)
const [worktrees, setWorktrees] = createSignal<Worktree[]>([])
const [loading, setLoading] = createSignal(false)

async function reload(): Promise<void> {
  const repo = graphStore.currentRepo()
  if (!repo) return
  setLoading(true)
  try {
    setWorktrees(await request('listWorktrees', { repo }))
  } catch (e) {
    graphStore.setError(e instanceof Error ? e.message : String(e))
  } finally {
    setLoading(false)
  }
}

async function togglePanel(): Promise<void> {
  const next = !panelOpen()
  setPanelOpen(next)
  if (next) await reload()
}

/** worktree 추가 — 기존 브랜치 체크아웃 또는 새 브랜치 생성 */
async function addWorktree(): Promise<void> {
  const repo = graphStore.currentRepo()
  if (!repo) return
  const repoName = repo.split('/').pop() ?? 'repo'
  const values = await formDialog({
    title: 'Add Worktree',
    fields: [
      {
        kind: 'text',
        name: 'branch',
        label: 'Branch (기존 브랜치명 또는 새 브랜치명)',
        placeholder: 'feature/…',
      },
      { kind: 'checkbox', name: 'create', label: 'Create new branch (-b)', initial: false },
      {
        kind: 'text',
        name: 'path',
        label: 'Worktree path',
        placeholder: `../${repoName}-<branch>`,
      },
    ],
    confirmLabel: 'Add',
  })
  if (!values) return
  const branch = String(values.branch).trim()
  let path = String(values.path).trim()
  if (branch === '') return
  if (path === '') path = `../${repoName}-${branch.replace(/\//g, '-')}`
  const ok = await graphStore.runAction(
    request('addWorktree', {
      repo,
      path,
      branch,
      createBranch: Boolean(values.create),
      startPoint: null,
    }),
  )
  if (ok) await reload()
}

/** worktree 제거 — 실패(변경사항 존재 등) 시 force 재확인 ⚠️ */
async function removeWorktree(worktree: Worktree): Promise<void> {
  const repo = graphStore.currentRepo()
  if (!repo) return
  const ok = await confirmDialog({
    title: 'Remove Worktree',
    message: `${worktree.path}\n\n이 worktree를 제거할까요? (브랜치는 삭제되지 않습니다)`,
    confirmLabel: 'Remove',
    danger: true,
  })
  if (!ok) return
  const result = await request('removeWorktree', { repo, path: worktree.path, force: false })
  if (result.ok) {
    await graphStore.refresh()
    await reload()
    return
  }
  // 변경사항이 있어 실패 → stderr를 보여주고 force 재확인
  const forceOk = await confirmDialog({
    title: 'Force Remove Worktree',
    message: `제거 실패:\n${result.error}\n\n강제로 제거할까요? 워킹트리의 변경사항이 유실됩니다.`,
    confirmLabel: 'Force Remove',
    danger: true,
  })
  if (!forceOk) return
  const forced = await graphStore.runAction(
    request('removeWorktree', { repo, path: worktree.path, force: true }),
  )
  if (forced) await reload()
}

/** worktree를 새 창으로 연다 */
async function openWorktree(path: string): Promise<void> {
  await request('openWorktree', { path })
}

/** 그래프 라벨에서: 해당 브랜치가 체크아웃된 worktree를 새 창으로 연다 */
async function openWorktreeForBranch(branch: string): Promise<void> {
  const repo = graphStore.currentRepo()
  if (!repo) return
  try {
    const list = await request('listWorktrees', { repo })
    const found = list.find((w) => w.branch === branch)
    if (found) await openWorktree(found.path)
  } catch (e) {
    graphStore.setError(e instanceof Error ? e.message : String(e))
  }
}

export const worktreeStore = {
  panelOpen,
  worktrees,
  loading,
  togglePanel,
  closePanel: () => setPanelOpen(false),
  reload,
  addWorktree,
  removeWorktree,
  openWorktree,
  openWorktreeForBranch,
}
