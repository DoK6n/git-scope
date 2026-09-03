import type { GitRef } from '@shared-types/domain'
import { createSignal, For, Show } from 'solid-js'
import { t } from '../../../shared/lib'
import { GitIcon } from '../../../shared/ui'
import type { GitIconName } from '../../../shared/ui'
import type { RefGroup } from '../lib/group'

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
  /** 드래그 시작 — 지정하면 뱃지가 draggable이 된다 (브랜치 드래그앤드롭용) */
  onDragStart?: (e: DragEvent) => void
  /** 진행 중인 드래그를 이 뱃지에 드롭할 수 있는지 */
  canDrop?: (e: DragEvent) => boolean
  /** 드롭 처리 */
  onDrop?: (e: DragEvent) => void
}

/**
 * 브랜치/원격/태그 라벨 칩 — 어두운 배경 + 브랜치색 테두리 + 색상 아이콘 칩.
 * 로컬 브랜치와 같은 커밋의 대응 원격은 한 뱃지 안에 "이름 | origin" 형태로 합쳐진다.
 * 체크아웃된 브랜치는 뱃지 왼쪽 바깥에 ○ 마커를 두고 이름을 굵게 표시한다.
 */
export function RefBadge(props: RefBadgeProps) {
  const gitRef = () => props.group.ref
  const color = () => props.color
  const icon = (): GitIconName => {
    if (gitRef().type === 'tag') return 'tag'
    if (gitRef().type === 'remote') return 'remote'
    return 'branch'
  }
  const [dragOver, setDragOver] = createSignal(false)
  return (
    <>
    <Show when={props.isHead}>
      <span class="ref-head-marker" style={{ color: color() }} title={t('HEAD — checked out branch')}>
        <svg viewBox="0 0 12 12" width="11" height="11">
          <circle cx="6" cy="6" r="3.4" fill="none" stroke="currentColor" stroke-width="2.2" />
        </svg>
      </span>
    </Show>
    <span
      class={`ref-badge ref-${gitRef().type}`}
      classList={{ 'ref-head': props.isHead, 'drop-target': dragOver() }}
      style={{ 'border-color': color(), '--ref-color': color() }}
      onClick={(e) => e.stopPropagation()} // 뱃지 클릭이 행 선택(상세뷰)으로 번지지 않게
      onContextMenu={(e) => props.onContextMenu?.(e)}
      onDblClick={(e) => {
        e.stopPropagation()
        props.onDblClick?.()
      }}
      title={props.onDblClick ? t('Double-click: git switch') : undefined}
      draggable={props.onDragStart !== undefined}
      onDragStart={(e) => props.onDragStart?.(e)}
      onDragEnter={(e) => {
        if (props.canDrop?.(e)) setDragOver(true)
      }}
      onDragLeave={(e) => {
        // 자식 요소로의 이동은 무시한다
        if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null)) {
          setDragOver(false)
        }
      }}
      onDragOver={(e) => {
        // preventDefault 해야 브라우저가 드롭을 허용한다
        if (props.canDrop?.(e)) e.preventDefault()
      }}
      onDrop={(e) => {
        setDragOver(false)
        if (!props.onDrop) return
        e.preventDefault()
        e.stopPropagation()
        props.onDrop(e)
      }}
    >
      <span class="ref-local-part">
        <span class="ref-icon">
          <GitIcon name={icon()} size={11} />
        </span>
        <Show when={props.isWorktree}>
          <span class="ref-worktree-mark" title={t('checked out in a worktree')}>⊕</span>
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
            <GitIcon name="remote" size={10} />
            {remote.remote}
          </span>
        )}
      </For>
    </span>
    </>
  )
}
