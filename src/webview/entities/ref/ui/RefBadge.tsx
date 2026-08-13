import type { GitRef } from '@shared-types/domain'
import { Show } from 'solid-js'

interface RefBadgeProps {
  gitRef: GitRef
  /** 현재 체크아웃된 브랜치인지 */
  isHead?: boolean
  /** worktree에 체크아웃되어 있는 브랜치인지 */
  isWorktree?: boolean
  onContextMenu?: (e: MouseEvent) => void
}

/** 브랜치/원격 브랜치/태그 라벨 칩 */
export function RefBadge(props: RefBadgeProps) {
  return (
    <span
      class={`ref-badge ref-${props.gitRef.type}`}
      classList={{ 'ref-head': props.isHead }}
      onContextMenu={(e) => props.onContextMenu?.(e)}
    >
      <Show when={props.isHead}>
        <span class="ref-head-dot">●</span>
      </Show>
      <Show when={props.isWorktree}>
        <span class="ref-worktree-mark" title="checked out in a worktree">⊕</span>
      </Show>
      {props.gitRef.name}
    </span>
  )
}
