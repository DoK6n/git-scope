import { graphStore } from '../../../entities/graph'
import { request } from '../../../shared/api'
import { confirmDialog, formDialog } from '../../../shared/ui'

/** 로컬 브랜치 checkout */
export async function checkoutBranch(name: string): Promise<void> {
  const repo = graphStore.currentRepo()
  if (!repo) return
  await graphStore.runAction(request('checkoutBranch', { repo, name }))
}

/** 원격 브랜치 checkout — 추적 로컬 브랜치명을 입력받아 생성 */
export async function checkoutRemoteBranch(remoteName: string): Promise<void> {
  const repo = graphStore.currentRepo()
  if (!repo) return
  const suggested = remoteName.split('/').slice(1).join('/')
  const values = await formDialog({
    title: `Checkout Remote Branch: ${remoteName}`,
    fields: [
      { kind: 'text', name: 'localName', label: 'Local branch name', initial: suggested },
    ],
    confirmLabel: 'Checkout',
  })
  if (!values || String(values.localName).trim() === '') return
  await graphStore.runAction(
    request('checkoutRemoteBranch', {
      repo,
      remoteName,
      localName: String(values.localName).trim(),
    }),
  )
}

/** 커밋 checkout — detached HEAD 경고 확인 후 실행 */
export async function checkoutCommit(hash: string): Promise<void> {
  const repo = graphStore.currentRepo()
  if (!repo) return
  const ok = await confirmDialog({
    title: 'Checkout Commit',
    message: `${hash.slice(0, 8)} 커밋을 체크아웃하면 detached HEAD 상태가 됩니다.\n계속할까요?`,
    confirmLabel: 'Checkout',
  })
  if (!ok) return
  await graphStore.runAction(request('checkoutCommit', { repo, hash }))
}
