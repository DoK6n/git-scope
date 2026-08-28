import { createMemo, For, Show } from 'solid-js'
import type { Commit, GitRef } from '@shared-types/domain'
import { AuthorAvatar } from '../../../entities/author'
import { groupRefs, isRemoteHeadRef, RefBadge } from '../../../entities/ref'
import { graphStore } from '../../../entities/graph'
import { dropBranchOn, isBranchDrag, startBranchDrag } from '../../../features/branch-dnd'
import { checkoutBranch, checkoutRemoteBranch } from '../../../features/checkout'
import { fixupKind, scrollToFixupTarget } from '../../../features/fixup'
import { BRANCH_PALETTE, formatDate, shortHash, t } from '../../../shared/lib'
import { openContextMenu } from '../../../shared/ui'
import { buildRefMenu } from '../model/refMenu'

interface CommitRowProps {
  commit: Commit
  top: number
  graphWidth: number
  refs: GitRef[]
  /** 이 커밋이 놓인 그래프 라인의 색상 인덱스 (layout rows[i].color) */
  colorIndex: number
  selected: boolean
  compared?: boolean
  searchMatch?: boolean
  searchCurrent?: boolean
  /** drag-to-reset 미리보기: 그래프에서 사라질 커밋 (erased + 도달 불가 사이드 커밋) */
  resetDoomed?: boolean
  /** drag-to-reset 미리보기: 브랜치에서 제거될 first-parent 체인 커밋 — "reset" 칩 표시 */
  resetErased?: boolean
  /** drag-to-reset 미리보기: 새 HEAD가 될 커밋 */
  resetNewHead?: boolean
  onClick: (e: MouseEvent) => void
  onContextMenu: (e: MouseEvent) => void
}

/** fixup 뱃지용 글리프 — 아래(대상 커밋)로 꺾여 들어가는 화살표 */
function FixupGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="10" height="10">
      <path
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        d="M12 2.5 v4.5 a3.5 3.5 0 0 1 -3.5 3.5 H5.5"
      />
      <path fill="currentColor" d="M7.5 6.5 v8 L2 10.5 z" />
    </svg>
  )
}

/** 스태시 뱃지용 상자 글리프 — 자체 제작 (클린룸: 원본 아이콘 자산 미사용) */
function StashGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="10" height="10">
      <path
        fill="currentColor"
        d="M1.5 3h13a.5.5 0 0 1 .5.5V6h-14V3.5a.5.5 0 0 1 .5-.5zM2 7h12v5.5a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5V7zm4 1.5v1h4v-1H6z"
      />
    </svg>
  )
}

export function CommitRow(props: CommitRowProps) {
  const date = () =>
    graphStore.settings().dateType === 'commit'
      ? props.commit.commitDate
      : props.commit.authorDate

  // 로컬 브랜치 + 같은 커밋의 대응 원격을 한 뱃지로 합친다
  const refGroups = createMemo(() => groupRefs(props.refs))

  // 뱃지 색 = 이 커밋이 속한 그래프 라인의 색 (원본 Git Graph와 동일한 규칙)
  const lineColor = () => BRANCH_PALETTE[props.colorIndex % BRANCH_PALETTE.length]!

  return (
    <div
      class="commit-row"
      classList={{
        selected: props.selected,
        compared: props.compared,
        uncommitted: props.commit.isUncommitted,
        stash: props.commit.stashSelector !== undefined,
        'search-match': props.searchMatch,
        'search-current': props.searchCurrent,
        doomed: props.resetDoomed,
        'new-head': props.resetNewHead,
      }}
      style={{ top: `${props.top}px` }}
      onClick={(e) => props.onClick(e)}
      onContextMenu={(e) => props.onContextMenu(e)}
    >
      <div class="col-graph" style={{ width: `${props.graphWidth}px` }} />
      <div class="col-message">
        <For each={refGroups()}>
          {(group) => (
            <RefBadge
              group={group}
              color={lineColor()}
              isHead={
                group.ref.type === 'head' && group.ref.name === graphStore.graph()?.headBranch
              }
              isWorktree={
                group.ref.type === 'head' &&
                (graphStore.graph()?.worktreeBranches ?? []).includes(group.ref.name)
              }
              onContextMenu={(e) => {
                const items = buildRefMenu(group.ref)
                if (items.length > 0) openContextMenu(e, items)
              }}
              onRemoteContextMenu={(remote, e) => {
                const items = buildRefMenu(remote)
                if (items.length > 0) openContextMenu(e, items)
              }}
              onDragStart={
                group.ref.type === 'tag' || isRemoteHeadRef(group.ref)
                  ? undefined
                  : (e) => startBranchDrag(e, group.ref)
              }
              canDrop={group.ref.type === 'head' ? isBranchDrag : undefined}
              onDrop={
                group.ref.type === 'head'
                  ? (e) => void dropBranchOn(e, group.ref.name)
                  : undefined
              }
              onDblClick={
                group.ref.type === 'tag' || isRemoteHeadRef(group.ref)
                  ? undefined
                  : () => {
                      // 더블클릭 = git switch. 이미 체크아웃됐거나 worktree에 있으면 무시
                      const isCheckedOut =
                        group.ref.type === 'head' &&
                        group.ref.name === graphStore.graph()?.headBranch
                      const inWorktree =
                        group.ref.type === 'head' &&
                        (graphStore.graph()?.worktreeBranches ?? []).includes(group.ref.name)
                      if (isCheckedOut || inWorktree) return
                      if (group.ref.type === 'head') void checkoutBranch(group.ref.name)
                      else void checkoutRemoteBranch(group.ref.name)
                    }
              }
            />
          )}
        </For>
        <Show when={props.commit.stashSelector}>
          {(selector) => (
            <span
              class="ref-badge stash-badge"
              style={{ 'border-color': lineColor(), '--ref-color': lineColor() }}
              title={selector()}
            >
              <span class="ref-local-part">
                <span class="ref-icon" style={{ 'background-color': lineColor() }}>
                  <StashGlyph />
                </span>
                <span class="ref-name">{selector()}</span>
              </span>
            </span>
          )}
        </Show>
        <Show when={fixupKind(props.commit.subject)}>
          {(kind) => (
            <span
              class="ref-badge fixup-badge"
              style={{ 'border-color': lineColor(), '--ref-color': lineColor() }}
              title={t('Click: go to target commit · autosquash via right-click menu')}
              onClick={(e) => {
                e.stopPropagation()
                scrollToFixupTarget(props.commit)
              }}
            >
              <span class="ref-local-part">
                <span class="ref-icon" style={{ 'background-color': lineColor() }}>
                  <FixupGlyph />
                </span>
                <span class="ref-name">{kind()}</span>
              </span>
            </span>
          )}
        </Show>
        <span class="commit-subject">{props.commit.subject}</span>
        <Show when={props.resetErased}>
          <span class="reset-chip">reset</span>
        </Show>
        <Show when={props.resetNewHead}>
          <span class="new-head-chip">{t('→ new HEAD')}</span>
        </Show>
      </div>
      <Show when={!props.commit.isUncommitted}>
        <div class="col-author" title={props.commit.authorEmail}>
          <Show when={graphStore.currentRepo()}>
            <span class="avatar-stack">
              <AuthorAvatar
                repo={graphStore.currentRepo()!}
                name={props.commit.author}
                email={props.commit.authorEmail}
                commitHash={props.commit.hash}
              />
              <For each={props.commit.coAuthors ?? []}>
                {(coAuthor) => (
                  <AuthorAvatar
                    repo={graphStore.currentRepo()!}
                    name={coAuthor.name}
                    email={coAuthor.email}
                    commitHash={props.commit.hash}
                    isCoAuthor
                  />
                )}
              </For>
            </span>
          </Show>
          <span class="author-name">{props.commit.author}</span>
        </div>
        <div class="col-date">{formatDate(date())}</div>
        <div class="col-hash">{shortHash(props.commit.hash)}</div>
      </Show>
    </div>
  )
}
