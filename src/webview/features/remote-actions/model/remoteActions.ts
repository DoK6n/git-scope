import { graphStore } from '../../../entities/graph'
import { request } from '../../../shared/api'
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
      v.force ? '원격 브랜치 이력을 덮어쓸 수 있습니다 (--force-with-lease로 최소한의 보호만 적용).' : null,
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
    `push ${values.remote}/${name} 완료`,
  )
}

/** 원격 브랜치를 현재 브랜치로 pull */
export async function pullBranch(remote: string, branch: string): Promise<void> {
  const r = repo()
  if (!r) return
  const ok = await confirmDialog({
    title: `Pull ${remote}/${branch}`,
    message: `${remote}/${branch}를 현재 브랜치로 pull 합니다.`,
    confirmLabel: 'Pull',
  })
  if (!ok) return
  await graphStore.runAction(
    request('pullBranch', { repo: r, remote, branch }),
    `pull ${remote}/${branch} 완료`,
  )
}

/** 원격 브랜치 삭제 ⚠️ */
export async function deleteRemoteBranch(remote: string, name: string): Promise<void> {
  const r = repo()
  if (!r) return
  const ok = await confirmDialog({
    title: 'Delete Remote Branch',
    message: `원격 ${remote}에서 브랜치 "${name}"을(를) 삭제합니다. 되돌리기 어렵습니다.`,
    confirmLabel: 'Delete',
    danger: true,
  })
  if (!ok) return
  await graphStore.runAction(
    request('deleteRemoteBranch', { repo: r, remote, name }),
    `원격 브랜치 ${remote}/${name} 삭제 완료`,
  )
}

/** 원격 브랜치를 로컬 브랜치로 fetch (fast-forward) */
export async function fetchIntoLocal(remote: string, remoteBranch: string): Promise<void> {
  const r = repo()
  if (!r) return
  const ok = await confirmDialog({
    title: `Fetch into local branch`,
    message: `${remote}/${remoteBranch} → 로컬 ${remoteBranch} 브랜치로 fetch 합니다 (fast-forward만).`,
    confirmLabel: 'Fetch',
  })
  if (!ok) return
  await graphStore.runAction(
    request('fetchIntoLocal', { repo: r, remote, remoteBranch, localBranch: remoteBranch }),
    `fetch ${remote}/${remoteBranch} → ${remoteBranch} 완료`,
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
    `push tag ${name} 완료`,
  )
}
