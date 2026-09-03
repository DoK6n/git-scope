import { createSignal } from 'solid-js'
import type {
  AuthorStatsEntry,
  AuthorStatsPeriod,
  AuthorStatsScope,
} from '@shared-types/domain'
import { graphStore } from '../../../entities/graph'
import { request } from '../../../shared/api'

const [panelOpen, setPanelOpen] = createSignal(false)
const [scope, setScopeValue] = createSignal<AuthorStatsScope>('currentBranch')
const [period, setPeriodValue] = createSignal<AuthorStatsPeriod>('all')
const [authors, setAuthors] = createSignal<AuthorStatsEntry[]>([])
const [loading, setLoading] = createSignal(false)
const [error, setError] = createSignal<string | null>(null)
let requestVersion = 0

async function reload(): Promise<void> {
  const repo = graphStore.currentRepo()
  if (!repo) return
  const version = ++requestVersion
  setLoading(true)
  setError(null)
  try {
    const result = await request('getAuthorStats', { repo, scope: scope(), period: period() })
    if (version === requestVersion) setAuthors(result)
  } catch (e) {
    if (version !== requestVersion) return
    const message = e instanceof Error ? e.message : String(e)
    setAuthors([])
    setError(message)
    graphStore.setError(message)
  } finally {
    if (version === requestVersion) setLoading(false)
  }
}

async function togglePanel(): Promise<void> {
  const next = !panelOpen()
  setPanelOpen(next)
  if (next) await reload()
}

async function setScope(value: AuthorStatsScope): Promise<void> {
  if (value === scope()) return
  setScopeValue(value)
  if (panelOpen()) await reload()
}

async function setPeriod(value: AuthorStatsPeriod): Promise<void> {
  if (value === period()) return
  setPeriodValue(value)
  if (panelOpen()) await reload()
}

export const authorStatsStore = {
  panelOpen,
  scope,
  period,
  authors,
  loading,
  error,
  togglePanel,
  closePanel: () => setPanelOpen(false),
  reload,
  setScope,
  setPeriod,
}
