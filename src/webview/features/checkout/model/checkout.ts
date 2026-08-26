import { graphStore } from '../../../entities/graph'
import { request } from '../../../shared/api'
import { t } from '../../../shared/lib'
import { confirmDialog, formDialog } from '../../../shared/ui'

/** 로컬 브랜치 checkout */
export async function checkoutBranch(name: string): Promise<void> {
  const repo = graphStore.currentRepo()
  if (!repo) return
  // 다른 worktree에 체크아웃된 브랜치 등 git이 거부하면 에러 다이얼로그로 표시
  await graphStore.runAction(
    request('checkoutBranch', { repo, name }),
    undefined,
    'Unable to Checkout Branch',
  )
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
    undefined,
    'Unable to Checkout Branch',
  )
}

/** 커밋 checkout — detached HEAD 경고 확인 후 실행 */
export async function checkoutCommit(hash: string): Promise<void> {
  const repo = graphStore.currentRepo()
  if (!repo) return
  const ok = await confirmDialog({
    title: 'Checkout Commit',
    message: t('Checking out commit {0} puts the repository in a detached HEAD state.\nContinue?', hash.slice(0, 8)),
    confirmLabel: 'Checkout',
  })
  if (!ok) return
  await graphStore.runAction(
    request('checkoutCommit', { repo, hash }),
    undefined,
    'Unable to Checkout Commit',
  )
}
