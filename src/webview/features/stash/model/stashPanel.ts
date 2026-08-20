import { createSignal } from 'solid-js'
import type { StashEntry } from '@shared-types/domain'
import { graphStore } from '../../../entities/graph'
import { request } from '../../../shared/api'

const [panelOpen, setPanelOpen] = createSignal(false)
const [stashes, setStashes] = createSignal<StashEntry[]>([])
const [loading, setLoading] = createSignal(false)

async function reload(): Promise<void> {
  const repo = graphStore.currentRepo()
  if (!repo) return
  setLoading(true)
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

export const stashPanelStore = {
  panelOpen,
  stashes,
  loading,
  togglePanel,
  closePanel: () => setPanelOpen(false),
  reload,
}
