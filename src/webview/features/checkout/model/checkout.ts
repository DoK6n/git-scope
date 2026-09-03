import { graphStore } from '../../../entities/graph'
import { request } from '../../../shared/api'
import { t } from '../../../shared/lib'
import { confirmDialog, errorDialog, formDialog } from '../../../shared/ui'

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

/** 원격 브랜치 checkout — 새 추적 브랜치를 만들거나 동명 로컬 브랜치를 안전하게 동기화 */
export async function checkoutRemoteBranch(remoteName: string, remoteHint?: string): Promise<void> {
  const repo = graphStore.currentRepo()
  if (!repo) return
  const remote = remoteHint ?? remoteName.split('/')[0]!
  const branch = remoteName.startsWith(`${remote}/`)
    ? remoteName.slice(remote.length + 1)
    : remoteName.split('/').slice(1).join('/')
  if (branch === '') return
  const suggested = branch
  const values = await formDialog({
    title: `Checkout Remote Branch: ${remoteName}`,
    fields: [
      { kind: 'text', name: 'localName', label: 'Local branch name', initial: suggested },
    ],
    confirmLabel: 'Checkout',
  })
  if (!values || String(values.localName).trim() === '') return
  const localName = String(values.localName).trim()

  let plan
  try {
    plan = await request('getRemoteCheckoutPlan', { repo, remote, branch, localName })
  } catch (error) {
    await errorDialog({
      title: t('Unable to Checkout Branch'),
      message: error instanceof Error ? error.message : String(error),
    })
    return
  }

  let mode: 'create' | 'checkout-only' | 'checkout-and-pull' = 'create'
  let successMessage = t('Checked out new tracking branch {0}', localName)
  if (plan.localExists) {
    const counts = t(
      'Local branch {0} is {1} commit(s) ahead and {2} commit(s) behind {3}.',
      localName,
      plan.ahead,
      plan.behind,
      remoteName,
    )
    if (plan.ahead === 0) {
      const confirmed = await confirmDialog({
        title: t('Checkout and Pull Remote Branch'),
        message: `${counts}\n\n${t(
          'Checkout {0}, then pull from {1} with fast-forward only?',
          localName,
          remoteName,
        )}`,
        confirmLabel: t('Checkout and Pull'),
      })
      if (!confirmed) return
      mode = 'checkout-and-pull'
      successMessage = t('Checked out {0} and pulled {1}', localName, remoteName)
    } else {
      const confirmed = await confirmDialog({
        title: t('Automatic Pull Blocked'),
        message: `${counts}\n\n${t(
          'Automatic pull will not run because the local branch is ahead or diverged. Checkout the local branch without pulling?',
        )}`,
        confirmLabel: t('Checkout Only'),
      })
      if (!confirmed) return
      mode = 'checkout-only'
      successMessage = t('Checked out {0} without pulling', localName)
    }
  }

  await graphStore.runAction(
    request('checkoutRemoteBranch', {
      repo,
      remote,
      branch,
      localName,
      mode,
    }),
    successMessage,
    t('Unable to Checkout Branch'),
    true,
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
