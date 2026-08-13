import type { Commit } from '@shared-types/domain'
import { request } from '../../../shared/api'
import type { MenuItem } from '../../../shared/ui'

/** 커밋 행 우클릭 메뉴 구성 */
export function buildRowMenu(commit: Commit): MenuItem[] {
  if (commit.isUncommitted) return []
  return [
    {
      label: 'Copy Commit Hash',
      onClick: () => void request('copyToClipboard', { text: commit.hash }),
    },
    {
      label: 'Copy Commit Subject',
      onClick: () => void request('copyToClipboard', { text: commit.subject }),
    },
  ]
}
