import { createEffect, createMemo, createResource, createSignal, For, Show } from 'solid-js'
import type { FileChange, IconSpec } from '@shared-types/domain'
import { graphStore } from '../../../entities/graph'
import { request } from '../../../shared/api'
import { formatDate, t } from '../../../shared/lib'
import { GoToFileIcon } from '../../../shared/ui'
import { basename, buildFileTree } from '../lib/fileTree'
import type { FileTreeFolder } from '../lib/fileTree'
import { ensureIcons, getFileIcon, getFolderIcon } from '../model/fileIcons'

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
  /** 비교 모드면 [과거, 최신] 해시 쌍 — 행 순서(아래=과거)로 결정 */
  const comparePair = createMemo<[string, string] | null>(() => {
    const selected = graphStore.selectedCommit()
    const compare = graphStore.compareWith()
    if (!selected || !compare) return null
    const commits = graphStore.graph()?.commits ?? []
    const selectedRow = commits.findIndex((c) => c.hash === selected)
    const compareRow = commits.findIndex((c) => c.hash === compare)
    return selectedRow > compareRow ? [selected, compare] : [compare, selected]
  })

  const [details] = createResource(
    () => {
      const repo = graphStore.currentRepo()
      const hash = graphStore.selectedCommit()
      if (!repo || !hash) return null
      return { repo, hash, pair: comparePair() }
    },
    (source) =>
      source.pair
        ? request('getCommitComparison', {
            repo: source.repo,
            fromHash: source.pair[0],
            toHash: source.pair[1],
          })
        : request('getCommitDetails', { repo: source.repo, hash: source.hash }),
  )

  // 상세 본문을 먼저 보여준 뒤 라인 통계만 별도 git diff로 비동기 계산한다.
  const [lineStatsFailed, setLineStatsFailed] = createSignal(false)
  const [lineStats] = createResource(
    () => {
      const repo = graphStore.currentRepo()
      const detail = details()
      if (!repo || !detail || comparePair()) return null
      return { repo, hash: detail.hash, baseHash: detail.parents[0] ?? null }
    },
    async (source) => {
      setLineStatsFailed(false)
      try {
        return await request('getCommitLineStats', source)
      } catch {
        // 통계는 부가 정보다. diff 계산 실패가 상세 본문을 가리지 않게 한다.
        setLineStatsFailed(true)
        return null
      }
    },
  )

  const lineStatsTooltip = () => {
    const stats = lineStats()
    if (!stats) return ''
    const notes = [
      t('Additions +{0} / Deletions −{1}', stats.additions, stats.deletions),
      t('Blank and comment-only lines are excluded from the calculation.'),
    ]
    if (stats.fallbackFiles > 0) {
      notes.push(t('{0} unsupported file(s) use raw counts', stats.fallbackFiles))
    }
    if (stats.binaryFiles > 0) notes.push(t('{0} binary file(s) excluded', stats.binaryFiles))
    return notes.join('\n')
  }

  const lineStatsNet = () => {
    const stats = lineStats()
    return stats ? stats.additions - stats.deletions : 0
  }

  const formattedLineStatsNet = () => {
    const net = lineStatsNet()
    if (net > 0) return `+${net}`
    if (net < 0) return `−${Math.abs(net)}`
    return '0'
  }

  // 상세가 로드되면 트리에 등장하는 파일/폴더 이름의 아이콘을 미리 로드
  createEffect(() => {
    const d = details()
    if (!d) return
    const folderNames: string[] = []
    const collect = (folder: FileTreeFolder) => {
      if (folder.name !== '') folderNames.push(basename(folder.name))
      folder.folders.forEach(collect)
    }
    collect(buildFileTree(d.files))
    void ensureIcons(
      d.files.map((f) => basename(f.path)),
      folderNames,
    )
  })

  const openDiff = (file: FileChange) => {
    const repo = graphStore.currentRepo()
    const hash = graphStore.selectedCommit()
    if (!repo || !hash) return
    const pair = comparePair()
    void request('openDiff', {
      repo,
      hash: pair ? pair[1] : hash,
      baseHash: pair ? pair[0] : null,
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
              <Show when={comparePair()}>
                <div class="details-compare">
                  Comparing{' '}
                  <span class="details-hash">{comparePair()![0].slice(0, 8)}</span> ↔{' '}
                  <span class="details-hash">{comparePair()![1].slice(0, 8)}</span> — {t('all changed files between the two commits')}
                </div>
              </Show>
              <div class="details-title-row">
                <div class="details-subject">{d().body.split('\n')[0]}</div>
                <Show when={!comparePair()}>
                  <Show
                    when={lineStats()}
                    fallback={
                      <span class="details-line-stats pending">
                        {lineStatsFailed() ? t('Line stats unavailable') : t('Calculating lines…')}
                      </span>
                    }
                  >
                    {(_stats) => (
                      <span class="details-line-stats" data-tip={lineStatsTooltip()}>
                        <span
                          classList={{
                            'file-added': lineStatsNet() > 0,
                            'file-removed': lineStatsNet() < 0,
                          }}
                        >
                          {formattedLineStatsNet()}
                        </span>
                      </span>
                    )}
                  </Show>
                </Show>
              </div>
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

/** 아이콘 테마의 svg 또는 폰트 글리프 렌더링. 테마가 없으면 표시 안 함 */
function IconView(props: { spec: IconSpec | null | undefined }) {
  return (
    <Show when={props.spec}>
      {(spec) => (
        <Show
          when={spec().svg}
          fallback={
            <span
              class="tree-icon tree-icon-font"
              style={{
                color: spec().fontColor,
                'font-family': spec().fontId ? `gs-fileicon-${spec().fontId}` : undefined,
                'font-size': spec().fontSize ?? '14px',
              }}
            >
              {spec().fontChar}
            </span>
          }
        >
          <img class="tree-icon" src={spec().svg} alt="" />
        </Show>
      )}
    </Show>
  )
}

/** 경로 복사 글리프 — 겹친 문서 두 장 (자체 제작) */
function CopyPathGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13">
      <g fill="none" stroke="currentColor" stroke-width="1.4">
        <rect x="5.2" y="4.2" width="8" height="9.6" rx="1.2" />
        <path d="M11 4.2 V3.4 A1.2 1.2 0 0 0 9.8 2.2 H4 A1.2 1.2 0 0 0 2.8 3.4 V10.4 A1.2 1.2 0 0 0 4 11.6 H5.2" />
      </g>
    </svg>
  )
}

function FileRow(props: {
  file: FileChange
  label: string
  depth?: number
  onOpen: (file: FileChange) => void
}) {
  const copyPath = (e: MouseEvent) => {
    e.stopPropagation()
    const repo = graphStore.currentRepo()
    if (!repo) return
    void request('copyToClipboard', { text: `${repo}/${props.file.path}` })
  }
  const openFile = (e: MouseEvent) => {
    e.stopPropagation()
    const repo = graphStore.currentRepo()
    if (!repo) return
    void request('openFile', { repo, path: props.file.path }).then((result) => {
      if (!result.ok) graphStore.setError(result.error)
    })
  }
  return (
    <button
      class="details-file"
      style={{ 'padding-left': `${6 + (props.depth ?? 0) * 14}px` }}
      title={`${fileLabel(props.file)} (${STATUS_LABEL[props.file.status] ?? props.file.status})`}
      onClick={() => props.onOpen(props.file)}
    >
      <IconView spec={getFileIcon(basename(props.file.path))} />
      <span class={`file-status status-${props.file.status}`}>{props.file.status}</span>
      <span class="file-path">{props.label}</span>
      <Show when={props.file.additions !== undefined}>
        <span class="file-linestat">
          (<span class="file-added">+{props.file.additions}</span>
          {' | '}
          <span class="file-removed">-{props.file.deletions}</span>)
        </span>
      </Show>
      {/* 행 hover 시에만 보이는 파일 액션 — 행 자체는 diff 열기라 클릭 전파를 막는다 */}
      <span class="file-actions">
        <span class="file-action" data-tip={t('Copy absolute path')} onClick={copyPath}>
          <CopyPathGlyph />
        </span>
        <Show when={props.file.status !== 'D'}>
          <span class="file-action" data-tip={t('Open file')} onClick={openFile}>
            <GoToFileIcon />
          </span>
        </Show>
      </span>
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
          <IconView spec={getFolderIcon(basename(props.folder.name), !collapsed())} />
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
