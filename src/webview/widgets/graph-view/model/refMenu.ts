import type { GitRef } from '@shared-types/domain'
import { request } from '../../../shared/api'
import type { MenuItem } from '../../../shared/ui'

/** 브랜치/태그 라벨 우클릭 메뉴 구성 */
export function buildRefMenu(ref: GitRef): MenuItem[] {
  return [
    {
      label: `Copy ${ref.type === 'tag' ? 'Tag' : 'Branch'} Name`,
      onClick: () => void request('copyToClipboard', { text: ref.name }),
    },
  ]
}
