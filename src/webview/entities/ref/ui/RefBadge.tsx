import type { GitRef } from '@shared-types/domain'
import { Show } from 'solid-js'
import { hashColor } from '../../../shared/lib'

/**
 * ref 이름 → 뱃지 색상. 원격 브랜치는 remote 접두사를 떼고 계산하므로
 * origin/main은 main과 항상 같은 색이 된다.
 */
function badgeColor(gitRef: GitRef): string {
  const name =
    gitRef.type === 'remote' && gitRef.remote
      ? gitRef.name.slice(gitRef.remote.length + 1)
      : gitRef.name
  return hashColor(name)
}

interface RefBadgeProps {
  gitRef: GitRef
  /** 현재 체크아웃된 브랜치인지 */
  isHead?: boolean
  /** worktree에 체크아웃되어 있는 브랜치인지 */
  isWorktree?: boolean
  onContextMenu?: (e: MouseEvent) => void
}

/** 브랜치/원격 브랜치/태그 라벨 칩 — 브랜치는 이름 기반 색상 */
export function RefBadge(props: RefBadgeProps) {
  const isBranch = () => props.gitRef.type !== 'tag'
  return (
    <span
      class={`ref-badge ref-${props.gitRef.type}`}
      classList={{ 'ref-head': props.isHead }}
      style={isBranch() ? { 'background-color': badgeColor(props.gitRef) } : undefined}
      onContextMenu={(e) => props.onContextMenu?.(e)}
    >
      <Show when={props.isHead}>
        <span class="ref-head-dot">●</span>
      </Show>
      <Show when={props.gitRef.type === 'remote'}>
        <span class="ref-remote-mark" title={`remote branch (${props.gitRef.remote})`}>🔌</span>
      </Show>
      <Show when={props.isWorktree}>
        <span class="ref-worktree-mark" title="checked out in a worktree">⊕</span>
      </Show>
      {props.gitRef.name}
    </span>
  )
}
