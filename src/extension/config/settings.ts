import * as vscode from 'vscode'
import type { WebviewSettings } from '@shared-types/messages'

export function readSettings(): WebviewSettings {
  const config = vscode.workspace.getConfiguration('gitScope')
  return {
    initialLoadCommits: config.get<number>('initialLoadCommits', 300),
    loadMoreCommits: config.get<number>('loadMoreCommits', 100),
    dateType: config.get<'author' | 'commit'>('dateType', 'author'),
    fetchPruneByDefault: config.get<boolean>('fetchPruneByDefault', false),
  }
}
