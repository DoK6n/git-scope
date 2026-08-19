import type { GitRef } from '@shared-types/domain'
import { For, Show } from 'solid-js'
import type { RefGroup } from '../lib/group'

/** 칩 안에 그리는 미니 브랜치 글리프 */
function BranchGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="10" height="10">
      <g fill="none" stroke="currentColor" stroke-width="2.2">
        <circle cx="5" cy="3.5" r="1.7" />
        <circle cx="5" cy="12.5" r="1.7" />
        <circle cx="11.5" cy="5" r="1.7" />
        <path d="M5 5.2 V10.8" />
        <path d="M11.5 6.8 C11.5 9.6, 5 8.4, 5 10.4" />
      </g>
    </svg>
  )
}

/** 태그용 미니 글리프 */
function TagGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="10" height="10">
      <path
        fill="currentColor"
        d="M2 2h5.2L14 8.8a1.5 1.5 0 0 1 0 2.1l-3.1 3.1a1.5 1.5 0 0 1-2.1 0L2 7.2V2zm3.2 4.2a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"
      />
    </svg>
  )
}

interface RefBadgeProps {
  group: RefGroup
  /** 이 ref가 놓인 커밋의 그래프 라인 색상 */
  color: string
  /** 현재 체크아웃된 브랜치인지 */
  isHead?: boolean
  /** worktree에 체크아웃되어 있는 브랜치인지 */
  isWorktree?: boolean
  onContextMenu?: (e: MouseEvent) => void
  /** 더블클릭 — 브랜치 switch 용 */
  onDblClick?: () => void
  /** 합쳐진 원격 세그먼트 우클릭 */
  onRemoteContextMenu?: (remote: GitRef, e: MouseEvent) => void
}

/**
 * 브랜치/원격/태그 라벨 칩 — 어두운 배경 + 브랜치색 테두리 + 색상 아이콘 칩.
 * 로컬 브랜치와 같은 커밋의 대응 원격은 한 뱃지 안에 "이름 | origin" 형태로 합쳐진다.
 */
export function RefBadge(props: RefBadgeProps) {
  const gitRef = () => props.group.ref
  const color = () => props.color
  return (
    <span
      class={`ref-badge ref-${gitRef().type}`}
      classList={{ 'ref-head': props.isHead }}
      style={{ 'border-color': color(), '--ref-color': color() }}
      onContextMenu={(e) => props.onContextMenu?.(e)}
      onDblClick={(e) => {
        e.stopPropagation()
        props.onDblClick?.()
      }}
      title={props.onDblClick ? '더블클릭: git switch' : undefined}
    >
      <span class="ref-local-part">
        <span class="ref-icon" style={{ 'background-color': color() }}>
          <Show when={gitRef().type === 'tag'} fallback={<BranchGlyph />}>
            <TagGlyph />
          </Show>
        </span>
        <Show when={props.isHead}>
          <span class="ref-head-dot">●</span>
        </Show>
        <Show when={props.isWorktree}>
          <span class="ref-worktree-mark" title="checked out in a worktree">⊕</span>
        </Show>
        <span
          class="ref-name"
          title={gitRef().type === 'remote' ? `remote branch (${gitRef().remote})` : undefined}
        >
          {gitRef().name}
        </span>
      </span>
      <For each={props.group.remotes}>
        {(remote) => (
          <span
            class="ref-remote-part"
            style={{ 'border-left-color': color() }}
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
