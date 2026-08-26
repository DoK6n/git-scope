import { createSignal } from 'solid-js'
import type { StashEntry } from '@shared-types/domain'
import { graphStore } from '../../../entities/graph'
import { request } from '../../../shared/api'
import { t } from '../../../shared/lib'
import { confirmDialog } from '../../../shared/ui'

const [panelOpen, setPanelOpen] = createSignal(false)
const [stashes, setStashes] = createSignal<StashEntry[]>([])
const [loading, setLoading] = createSignal(false)
/** 일괄 삭제용으로 체크된 셀렉터 집합 */
const [selected, setSelected] = createSignal<Set<string>>(new Set())

async function reload(): Promise<void> {
  const repo = graphStore.currentRepo()
  if (!repo) return
  setLoading(true)
  // 목록이 바뀌면 stash@{N} 인덱스가 밀리므로 선택은 항상 초기화한다
  setSelected(new Set<string>())
  try {
    setStashes(await request('listStashes', { repo }))
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

function toggleSelected(selector: string): void {
  const next = new Set(selected())
  if (next.has(selector)) next.delete(selector)
  else next.add(selector)
  setSelected(next)
}

function selectorIndex(selector: string): number {
  return Number(/\{(\d+)\}/.exec(selector)?.[1] ?? 0)
}

/** 체크된 스태시 일괄 삭제 ⚠️ — 인덱스가 큰 것부터 지워야 나머지 셀렉터가 밀리지 않는다 */
async function dropSelected(): Promise<void> {
  const repo = graphStore.currentRepo()
  if (!repo) return
  const selectors = [...selected()]
  if (selectors.length === 0) return
  const ok = await confirmDialog({
    title: `Drop ${selectors.length} Stash${selectors.length > 1 ? 'es' : ''}`,
    message: t('{0}\n\nDeletes all selected stashes. This cannot be undone.', selectors.sort((a, b) => selectorIndex(a) - selectorIndex(b)).join('\n')),
    confirmLabel: 'Drop',
    danger: true,
  })
  if (!ok) return
  const byIndexDesc = [...selectors].sort((a, b) => selectorIndex(b) - selectorIndex(a))
  let dropped = 0
  for (const selector of byIndexDesc) {
    const result = await request('stashDrop', { repo, selector })
    if (!result.ok) {
      graphStore.setError(result.error)
      break
    }
    dropped++
  }
  if (dropped > 0) graphStore.setNotice(t('Dropped {0} stashes', dropped))
  await graphStore.refresh()
  await reload()
}

export const stashPanelStore = {
  panelOpen,
  stashes,
  loading,
  selected,
  toggleSelected,
  dropSelected,
  togglePanel,
  closePanel: () => setPanelOpen(false),
  reload,
}
