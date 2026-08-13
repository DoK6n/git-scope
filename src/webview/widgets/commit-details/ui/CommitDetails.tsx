import { createResource, For, Show } from 'solid-js'
import type { FileChange } from '@shared-types/domain'
import { graphStore } from '../../../entities/graph'
import { request } from '../../../shared/api'
import { formatDate, shortHash } from '../../../shared/lib'

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

/** 선택된 커밋의 메타데이터 + 변경 파일 목록 패널 */
export function CommitDetails() {
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
    <Show when={graphStore.selectedCommit()}>
      <div class="commit-details">
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
    </Show>
  )
}
