import { createMemo, For, Show } from 'solid-js'
import type { Commit, GitRef } from '@shared-types/domain'
import { AuthorAvatar } from '../../../entities/author'
import { groupRefs, RefBadge } from '../../../entities/ref'
import { graphStore } from '../../../entities/graph'
import { checkoutBranch, checkoutRemoteBranch } from '../../../features/checkout'
import { BRANCH_PALETTE, formatDate, shortHash } from '../../../shared/lib'
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
  onClick: (e: MouseEvent) => void
  onContextMenu: (e: MouseEvent) => void
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
              onDblClick={
                group.ref.type === 'tag'
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
        <span class="commit-subject">{props.commit.subject}</span>
      </div>
      <Show when={!props.commit.isUncommitted}>
        <div class="col-author" title={props.commit.authorEmail}>
          <Show when={graphStore.currentRepo()}>
            <AuthorAvatar
              repo={graphStore.currentRepo()!}
              name={props.commit.author}
              email={props.commit.authorEmail}
              commitHash={props.commit.hash}
            />
          </Show>
          <span class="author-name">{props.commit.author}</span>
        </div>
        <div class="col-date">{formatDate(date())}</div>
        <div class="col-hash">{shortHash(props.commit.hash)}</div>
      </Show>
    </div>
  )
}
