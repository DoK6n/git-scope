import type { GitRef } from '@shared-types/domain'
import { For, Show } from 'solid-js'
import { hashColor } from '../../../shared/lib'
import type { RefGroup } from '../lib/group'

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
  group: RefGroup
  /** 현재 체크아웃된 브랜치인지 */
  isHead?: boolean
  /** worktree에 체크아웃되어 있는 브랜치인지 */
  isWorktree?: boolean
  onContextMenu?: (e: MouseEvent) => void
  /** 합쳐진 원격 세그먼트 우클릭 */
  onRemoteContextMenu?: (remote: GitRef, e: MouseEvent) => void
}

/**
 * 브랜치/원격/태그 라벨 칩.
 * 로컬 브랜치와 같은 커밋의 대응 원격은 한 뱃지 안에 "이름 | origin" 형태로 합쳐진다.
 */
export function RefBadge(props: RefBadgeProps) {
  const gitRef = () => props.group.ref
  const isBranch = () => gitRef().type !== 'tag'
  return (
    <span
      class={`ref-badge ref-${gitRef().type}`}
      classList={{ 'ref-head': props.isHead }}
      style={isBranch() ? { 'background-color': badgeColor(gitRef()) } : undefined}
      onContextMenu={(e) => props.onContextMenu?.(e)}
    >
      <Show when={props.isHead}>
        <span class="ref-head-dot">●</span>
      </Show>
      <Show when={gitRef().type === 'remote'}>
        <span class="ref-remote-mark" title={`remote branch (${gitRef().remote})`}>🔌</span>
      </Show>
      <Show when={props.isWorktree}>
        <span class="ref-worktree-mark" title="checked out in a worktree">⊕</span>
      </Show>
      {gitRef().name}
      <For each={props.group.remotes}>
        {(remote) => (
          <span
            class="ref-remote-part"
            title={remote.name}
            onContextMenu={(e) => {
              e.stopPropagation()
              props.onRemoteContextMenu?.(remote, e)
            }}
          >
            {remote.remote}
          </span>
        )}
      </For>
    </span>
  )
}
