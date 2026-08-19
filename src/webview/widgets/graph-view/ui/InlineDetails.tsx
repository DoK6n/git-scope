import { createMemo, createResource, createSignal, For, Show } from 'solid-js'
import type { FileChange } from '@shared-types/domain'
import { graphStore } from '../../../entities/graph'
import { request } from '../../../shared/api'
import { formatDate } from '../../../shared/lib'
import { basename, buildFileTree } from '../lib/fileTree'
import type { FileTreeFolder } from '../lib/fileTree'

/** 인라인 상세 패널 높이 (GraphView의 행 배치 계산과 공유) */
export const DETAILS_H = 300

const STATUS_LABEL: Record<string, string> = {
  A: 'added',
  M: 'modified',
  D: 'deleted',
  R: 'renamed',
  C: 'copied',
  T: 'type changed',
  U: 'unmerged',
  X: 'unknown',
}

/** 파일 목록 표시 모드 — 모듈 레벨이라 다른 커밋을 열어도 유지된다. 기본 tree */
const [filesView, setFilesView] = createSignal<'tree' | 'list'>('tree')

/**
 * 선택한 커밋 행 바로 아래로 펼쳐지는 상세 패널 (inline 방식).
 * 그래프 컬럼은 가리지 않고 Commit 컬럼부터 시작한다 — 그래프 라인은 왼쪽으로 계속 흐른다.
 */
export function InlineDetails(props: { top: number; left: number }) {
  const [details] = createResource(
    () => {
      const repo = graphStore.currentRepo()
      const hash = graphStore.selectedCommit()
      return repo && hash ? { repo, hash } : null
    },
    (source) => request('getCommitDetails', source),
  )

  const openDiff = (file: FileChange) => {
    const repo = graphStore.currentRepo()
    const hash = graphStore.selectedCommit()
    if (!repo || !hash) return
    void request('openDiff', {
      repo,
      hash,
      baseHash: null,
      path: file.path,
      oldPath: file.oldPath,
    })
  }

  return (
    <div
      class="commit-details-inline"
      style={{ top: `${props.top}px`, left: `${props.left}px` }}
    >
      <button class="details-close" onClick={() => graphStore.setSelectedCommit(null)}>
        ✕
      </button>
      <Show when={details()} fallback={<div class="details-loading">Loading…</div>}>
        {(d) => (
          <>
            <div class="details-meta">
              <div class="details-subject">{d().body.split('\n')[0]}</div>
              <div class="details-fields">
                <span class="details-field">
                  <b>Commit</b> <span class="details-hash">{d().hash}</span>
                </span>
                <span class="details-field">
                  <b>Parents</b> <span class="details-hash">{d().parents.join(', ') || '—'}</span>
                </span>
                <span class="details-field">
                  <b>Author</b> {d().author} &lt;{d().authorEmail}&gt;
                </span>
                <span class="details-field">
                  <b>Committer</b> {d().committer}
                </span>
                <span class="details-field">
                  <b>Date</b> {formatDate(d().authorDate)}
                </span>
              </div>
              <Show when={d().body.split('\n').slice(1).join('\n').trim()}>
                <pre class="details-body">{d().body.split('\n').slice(1).join('\n').trim()}</pre>
              </Show>
            </div>
            <div class="details-files">
              <div class="files-header">
                <span class="files-count">{d().files.length} files changed</span>
                <span class="files-view-toggle">
                  <button
                    class="toolbar-btn"
                    classList={{ primary: filesView() === 'tree' }}
                    title="Tree view"
                    onClick={() => setFilesView('tree')}
                  >
                    Tree
                  </button>
                  <button
                    class="toolbar-btn"
                    classList={{ primary: filesView() === 'list' }}
                    title="Flat list"
                    onClick={() => setFilesView('list')}
                  >
                    List
                  </button>
                </span>
              </div>
              <Show
                when={filesView() === 'tree'}
                fallback={
                  <For each={d().files}>
                    {(file) => <FileRow file={file} label={fileLabel(file)} onOpen={openDiff} />}
                  </For>
                }
              >
                <FolderView
                  folder={buildFileTree(d().files)}
                  depth={0}
                  isRoot
                  onOpen={openDiff}
                />
              </Show>
            </div>
          </>
        )}
      </Show>
    </div>
  )
}

function fileLabel(file: FileChange): string {
  return file.oldPath ? `${file.oldPath} → ${file.path}` : file.path
}

function FileRow(props: {
  file: FileChange
  label: string
  depth?: number
  onOpen: (file: FileChange) => void
}) {
  return (
    <button
      class="details-file"
      style={{ 'padding-left': `${6 + (props.depth ?? 0) * 14}px` }}
      title={`${fileLabel(props.file)} (${STATUS_LABEL[props.file.status] ?? props.file.status})`}
      onClick={() => props.onOpen(props.file)}
    >
      <span class={`file-status status-${props.file.status}`}>{props.file.status}</span>
      <span class="file-path">{props.label}</span>
      <Show when={props.file.additions !== undefined}>
        <span class="file-linestat">
          (<span class="file-added">+{props.file.additions}</span>
          {' | '}
          <span class="file-removed">-{props.file.deletions}</span>)
        </span>
      </Show>
    </button>
  )
}

function FolderView(props: {
  folder: FileTreeFolder
  depth: number
  isRoot?: boolean
  onOpen: (file: FileChange) => void
}) {
  const [collapsed, setCollapsed] = createSignal(false)
  const childDepth = createMemo(() => (props.isRoot ? props.depth : props.depth + 1))
  return (
    <>
      <Show when={!props.isRoot}>
        <button
          class="details-file file-tree-folder"
          style={{ 'padding-left': `${6 + props.depth * 14}px` }}
          onClick={() => setCollapsed(!collapsed())}
        >
          <span class="folder-arrow">{collapsed() ? '▸' : '▾'}</span>
          <span class="file-path">{props.folder.name}</span>
        </button>
      </Show>
      <Show when={props.isRoot || !collapsed()}>
        <For each={props.folder.folders}>
          {(sub) => <FolderView folder={sub} depth={childDepth()} onOpen={props.onOpen} />}
        </For>
        <For each={props.folder.files}>
          {(file) => (
            <FileRow
              file={file}
              label={basename(file.path)}
              depth={childDepth()}
              onOpen={props.onOpen}
            />
          )}
        </For>
      </Show>
    </>
  )
}
