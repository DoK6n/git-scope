import { graphStore } from '../../../entities/graph'
import type { StashEntry } from '@shared-types/domain'
import { request } from '../../../shared/api'
import { t } from '../../../shared/lib'
import { confirmDialog, formDialog } from '../../../shared/ui'

function repo(): string | null {
  return graphStore.currentRepo()
}

export async function stashApply(selector: string, pop: boolean): Promise<void> {
  const r = repo()
  if (!r) return
  const values = await formDialog({
    title: `${pop ? 'Pop' : 'Apply'} Stash: ${selector}`,
    fields: [
      { kind: 'checkbox', name: 'reinstateIndex', label: t('Restore the index (staged changes) too (--index)'), initial: false },
    ],
    confirmLabel: pop ? 'Pop' : 'Apply',
  })
  if (!values) return
  await graphStore.runAction(
    request(pop ? 'stashPop' : 'stashApply', {
      repo: r,
      selector,
      reinstateIndex: Boolean(values.reinstateIndex),
    }),
    t('Stash {0} {1} done', pop ? 'pop' : 'apply', selector),
  )
}

export async function stashDrop(selector: string): Promise<void> {
  const r = repo()
  if (!r) return
  const ok = await confirmDialog({
    title: `Drop Stash: ${selector}`,
    message: t('Deletes this stash. This cannot be undone.'),
    confirmLabel: 'Drop',
    danger: true,
  })
  if (!ok) return
  await graphStore.runAction(
    request('stashDrop', { repo: r, selector }),
    t('Dropped stash {0}', selector),
  )
}

export async function stashRename(stash: StashEntry): Promise<void> {
  const r = repo()
  if (!r) return
  const values = await formDialog({
    title: `Rename Stash: ${stash.selector}`,
    note: t('Renaming keeps the stash contents but moves it to the top of the list.'),
    fields: [
      {
        kind: 'text',
        name: 'message',
        label: t('Stash name'),
        initial: stash.message || stash.subject,
      },
    ],
    confirmLabel: 'Rename',
  })
  const message = values ? String(values.message).trim() : ''
  if (message === '' || message === stash.message) return
  await graphStore.runAction(
    request('stashRename', { repo: r, selector: stash.selector, message }),
    t('Renamed stash {0}', stash.selector),
  )
}

export async function stashBranch(selector: string): Promise<void> {
  const r = repo()
  if (!r) return
  const values = await formDialog({
    title: `Create Branch from Stash: ${selector}`,
    fields: [{ kind: 'text', name: 'name', label: 'Branch name', placeholder: 'feature/…' }],
    confirmLabel: 'Create',
  })
  if (!values || String(values.name).trim() === '') return
  await graphStore.runAction(
    request('stashBranch', { repo: r, selector, branchName: String(values.name).trim() }),
    t('Branch {0} created from stash', String(values.name).trim()),
  )
}

/** uncommitted 행: 워킹트리 변경을 stash로 저장 */
export async function stashPush(): Promise<void> {
  const r = repo()
  if (!r) return
  const values = await formDialog({
    title: 'Stash Uncommitted Changes',
    fields: [
      { kind: 'text', name: 'message', label: t('Message (optional)'), initial: '' },
      { kind: 'checkbox', name: 'includeUntracked', label: t('Include untracked files'), initial: true },
    ],
    confirmLabel: 'Stash',
  })
  if (!values) return
  await graphStore.runAction(
    request('stashPush', {
      repo: r,
      message: String(values.message),
      includeUntracked: Boolean(values.includeUntracked),
    }),
    t('Stashed working tree changes'),
  )
}

/** uncommitted 행: 추적되지 않은 파일 삭제 ⚠️ */
export async function cleanUntracked(): Promise<void> {
  const r = repo()
  if (!r) return
  const values = await formDialog({
    title: 'Clean Untracked Files',
    fields: [
      { kind: 'checkbox', name: 'directories', label: t('Also remove directories (-d)'), initial: true },
    ],
    confirmLabel: 'Clean',
    danger: true,
    warning: () => t('Untracked files will be permanently deleted. This cannot be undone.'),
  })
  if (!values) return
  await graphStore.runAction(
    request('cleanUntracked', { repo: r, directories: Boolean(values.directories) }),
    t('Clean done'),
  )
}

/** uncommitted 행: 모든 변경 폐기 ⚠️ */
export async function discardAllChanges(): Promise<void> {
  const r = repo()
  if (!r) return
  const ok = await confirmDialog({
    title: 'Discard All Changes',
    message: t('Discards all changes in the working tree and index (reset --hard HEAD).\nThis cannot be undone.'),
    confirmLabel: 'Discard',
    danger: true,
  })
  if (!ok) return
  await graphStore.runAction(request('discardAllChanges', { repo: r }), t('All changes discarded'))
}

export async function openScmView(): Promise<void> {
  await request('openScmView', {})
}
