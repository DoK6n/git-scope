import { createResource, For, Show } from 'solid-js'
import type { FileChange } from '@shared-types/domain'
import { graphStore } from '../../../entities/graph'
import { request } from '../../../shared/api'
import { formatDate, shortHash } from '../../../shared/lib'

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

/** 선택한 커밋 행 바로 아래로 펼쳐지는 상세 패널 (원본 Git Graph의 inline 방식) */
export function InlineDetails(props: { top: number }) {
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
    <div class="commit-details-inline" style={{ top: `${props.top}px` }}>
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
                  <b>Commit</b> {shortHash(d().hash)}
                </span>
                <span class="details-field">
                  <b>Parents</b> {d().parents.map(shortHash).join(', ') || '—'}
                </span>
                <span class="details-field">
                  <b>Author</b> {d().author} &lt;{d().authorEmail}&gt;
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
              <For each={d().files}>
                {(file) => (
                  <button
                    class="details-file"
                    title={STATUS_LABEL[file.status] ?? file.status}
                    onClick={() => openDiff(file)}
                  >
                    <span class={`file-status status-${file.status}`}>{file.status}</span>
                    <span class="file-path">
                      {file.oldPath ? `${file.oldPath} → ${file.path}` : file.path}
                    </span>
                  </button>
                )}
              </For>
            </div>
          </>
        )}
      </Show>
    </div>
  )
}
