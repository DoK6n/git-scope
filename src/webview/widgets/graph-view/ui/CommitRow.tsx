import { For, Show } from 'solid-js'
import type { Commit, GitRef } from '@shared-types/domain'
import { RefBadge } from '../../../entities/ref'
import { graphStore } from '../../../entities/graph'
import { formatDate, shortHash } from '../../../shared/lib'
import { openContextMenu } from '../../../shared/ui'
import { buildRefMenu } from '../model/refMenu'

interface CommitRowProps {
  commit: Commit
  top: number
  graphWidth: number
  refs: GitRef[]
  selected: boolean
  onClick: () => void
  onContextMenu: (e: MouseEvent) => void
}

export function CommitRow(props: CommitRowProps) {
  const date = () =>
    graphStore.settings().dateType === 'commit'
      ? props.commit.commitDate
      : props.commit.authorDate

  return (
    <div
      class="commit-row"
      classList={{ selected: props.selected, uncommitted: props.commit.isUncommitted }}
      style={{ top: `${props.top}px` }}
      onClick={() => props.onClick()}
      onContextMenu={(e) => props.onContextMenu(e)}
    >
      <div class="col-graph" style={{ width: `${props.graphWidth}px` }} />
      <div class="col-message">
        <For each={props.refs}>
          {(ref) => (
            <RefBadge
              gitRef={ref}
              isHead={ref.type === 'head' && ref.name === graphStore.graph()?.headBranch}
              isWorktree={
                ref.type === 'head' &&
                (graphStore.graph()?.worktreeBranches ?? []).includes(ref.name)
              }
              onContextMenu={(e) => {
                const items = buildRefMenu(ref)
                if (items.length > 0) openContextMenu(e, items)
              }}
            />
          )}
        </For>
        <span class="commit-subject">{props.commit.subject}</span>
      </div>
      <Show when={!props.commit.isUncommitted}>
        <div class="col-author" title={props.commit.authorEmail}>
          {props.commit.author}
        </div>
        <div class="col-date">{formatDate(date())}</div>
        <div class="col-hash">{shortHash(props.commit.hash)}</div>
      </Show>
    </div>
  )
}
