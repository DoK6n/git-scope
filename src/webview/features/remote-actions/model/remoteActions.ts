import { graphStore } from '../../../entities/graph'
import { request } from '../../../shared/api'
import { t } from '../../../shared/lib'
import { confirmDialog, formDialog } from '../../../shared/ui'

function repo(): string | null {
  return graphStore.currentRepo()
}

/** 그래프 refs에서 원격 이름 목록 (없으면 ['origin']) */
function remoteNames(): string[] {
  const names = new Set<string>()
  for (const ref of graphStore.graph()?.refs ?? []) {
    if (ref.type === 'remote' && ref.remote) names.add(ref.remote)
  }
  return names.size > 0 ? [...names] : ['origin']
}

/** 로컬 브랜치 push */
export async function pushBranch(name: string): Promise<void> {
  const r = repo()
  if (!r) return
  const values = await formDialog({
    title: `Push Branch: ${name}`,
    fields: [
      { kind: 'select', name: 'remote', label: 'Remote', options: remoteNames() },
      { kind: 'checkbox', name: 'setUpstream', label: 'Set upstream (-u)', initial: true },
      { kind: 'checkbox', name: 'force', label: 'Force push (--force-with-lease) ⚠️', initial: false },
    ],
    confirmLabel: 'Push',
    warning: (v) =>
      v.force ? t('May overwrite remote branch history (--force-with-lease applies minimal protection).') : null,
  })
  if (!values) return
  await graphStore.runAction(
    request('pushBranch', {
      repo: r,
      name,
      remote: String(values.remote),
      setUpstream: Boolean(values.setUpstream),
      force: Boolean(values.force),
    }),
    t('Pushed {0}', `${String(values.remote)}/${name}`),
  )
}

/** 원격 브랜치를 현재 브랜치로 pull */
export async function pullBranch(remote: string, branch: string): Promise<void> {
  const r = repo()
  if (!r) return
  const ok = await confirmDialog({
    title: `Pull ${remote}/${branch}`,
    message: t('Pull {0} into the current branch.', `${remote}/${branch}`),
    confirmLabel: 'Pull',
  })
  if (!ok) return
  await graphStore.runAction(
    request('pullBranch', { repo: r, remote, branch }),
    t('Pulled {0}', `${remote}/${branch}`),
  )
}

/** 원격 브랜치 삭제 ⚠️ */
export async function deleteRemoteBranch(remote: string, name: string): Promise<void> {
  const r = repo()
  if (!r) return
  const ok = await confirmDialog({
    title: 'Delete Remote Branch',
    message: t('Deletes branch "{1}" on remote {0}. This is hard to undo.', remote, name),
    confirmLabel: 'Delete',
    danger: true,
  })
  if (!ok) return
  await graphStore.runAction(
    request('deleteRemoteBranch', { repo: r, remote, name }),
    t('Deleted remote branch {0}', `${remote}/${name}`),
  )
}

/** 원격 브랜치를 로컬 브랜치로 fetch (fast-forward) */
export async function fetchIntoLocal(remote: string, remoteBranch: string): Promise<void> {
  const r = repo()
  if (!r) return
  const ok = await confirmDialog({
    title: `Fetch into local branch`,
    message: t('Fetches {0} into local branch {1} (fast-forward only).', `${remote}/${remoteBranch}`, remoteBranch),
    confirmLabel: 'Fetch',
  })
  if (!ok) return
  await graphStore.runAction(
    request('fetchIntoLocal', { repo: r, remote, remoteBranch, localBranch: remoteBranch }),
    t('Fetched {0} → {1}', `${remote}/${remoteBranch}`, remoteBranch),
  )
}

/** 태그 push */
export async function pushTag(name: string): Promise<void> {
  const r = repo()
  if (!r) return
  const values = await formDialog({
    title: `Push Tag: ${name}`,
    fields: [{ kind: 'select', name: 'remote', label: 'Remote', options: remoteNames() }],
    confirmLabel: 'Push',
  })
  if (!values) return
  await graphStore.runAction(
    request('pushTag', { repo: r, name, remote: String(values.remote) }),
    t('Pushed tag {0}', name),
  )
}
