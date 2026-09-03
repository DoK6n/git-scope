import type { InProgressOperationType } from '@shared-types/domain'
import { graphStore } from '../../../entities/graph'
import { request } from '../../../shared/api'
import { t } from '../../../shared/lib'
import { confirmDialog } from '../../../shared/ui'

export function operationBadgeText(operation: InProgressOperationType): string {
  switch (operation) {
    case 'merge':
      return 'merging'
    case 'rebase':
      return 'rebasing'
    case 'cherry-pick':
      return 'cherry-picking'
    case 'revert':
      return 'reverting'
  }
}

export async function confirmAbortOperation(operation: InProgressOperationType): Promise<void> {
  const repo = graphStore.currentRepo()
  if (!repo) return
  const label = t(operationBadgeText(operation))
  const confirmed = await confirmDialog({
    title: t('Abort {0}?', label),
    message: t(
      'This stops the {0} operation and returns the repository to the state before it started. Working tree and index changes made by the operation will be discarded.',
      label,
    ),
    confirmLabel: t('Abort'),
    danger: true,
  })
  if (!confirmed) return
  await graphStore.runAction(
    request('abortOperation', { repo, operation }),
    t('{0} operation aborted', label),
    t('Unable to abort {0}', label),
  )
}
