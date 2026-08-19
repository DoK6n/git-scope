import type {
  ActionResult,
  CommitDetails,
  GraphData,
  IconSpec,
  RepoInfo,
  Worktree,
} from './domain'

/**
 * webview → host 요청/응답 RPC 정의.
 * 키가 요청 command 이름, params/result가 페이로드 타입.
 */
export interface RequestMap {
  /** 열 수 있는 리포 목록 */
  listRepos: { params: Record<string, never>; result: RepoInfo[] }

  /** 그래프 데이터 로드 */
  getGraph: {
    params: {
      repo: string
      maxCommits: number
      /** null이면 모든 브랜치(+HEAD), 아니면 선택된 ref 이름 목록 */
      branches: string[] | null
    }
    result: GraphData
  }

  getCommitDetails: {
    params: { repo: string; hash: string }
    result: CommitDetails
  }

  /** 두 커밋 비교 (M5) — from..to 변경 파일 목록 */
  getCommitComparison: {
    params: { repo: string; fromHash: string; toHash: string }
    result: CommitDetails
  }

  /** 디프 에디터 열기 (host가 vscode.diff 실행) */
  openDiff: {
    params: {
      repo: string
      hash: string
      /** null이면 첫 부모(루트 커밋은 빈 트리) 기준 */
      baseHash: string | null
      path: string
      oldPath?: string
    }
    result: ActionResult
  }

  // ── 기본 액션 (M3) ─────────────────────────────
  checkoutBranch: { params: { repo: string; name: string }; result: ActionResult }
  checkoutRemoteBranch: {
    params: { repo: string; remoteName: string; localName: string }
    result: ActionResult
  }
  checkoutCommit: { params: { repo: string; hash: string }; result: ActionResult }
  createBranch: {
    params: { repo: string; name: string; at: string; checkout: boolean }
    result: ActionResult
  }
  deleteBranch: {
    params: { repo: string; name: string; force: boolean }
    result: ActionResult
  }
  renameBranch: {
    params: { repo: string; oldName: string; newName: string }
    result: ActionResult
  }
  merge: {
    params: { repo: string; target: string; noFf: boolean; squash: boolean }
    result: ActionResult
  }
  createTag: {
    params: { repo: string; name: string; at: string; message: string | null }
    result: ActionResult
  }
  deleteTag: { params: { repo: string; name: string }; result: ActionResult }

  // ── 신규 기능 (M4) ─────────────────────────────
  reset: {
    params: { repo: string; to: string; mode: 'soft' | 'mixed' | 'hard' }
    result: ActionResult
  }
  fetch: { params: { repo: string; prune: boolean }; result: ActionResult }
  listWorktrees: { params: { repo: string }; result: Worktree[] }
  addWorktree: {
    params: {
      repo: string
      path: string
      /** 체크아웃할 기존 브랜치 또는 새 브랜치명 */
      branch: string
      createBranch: boolean
      /** createBranch일 때 시작 지점 (기본 HEAD) */
      startPoint: string | null
    }
    result: ActionResult
  }
  removeWorktree: {
    params: { repo: string; path: string; force: boolean }
    result: ActionResult
  }
  openWorktree: { params: { path: string }; result: ActionResult }

  /** 활성 파일 아이콘 테마에서 파일/폴더 아이콘 해석 (트리 뷰용) */
  getFileIcons: {
    params: { files: string[]; folders: string[] }
    result: {
      files: Record<string, IconSpec | null>
      foldersCollapsed: Record<string, IconSpec | null>
      foldersExpanded: Record<string, IconSpec | null>
      /** 폰트 기반 테마의 @font-face 정보 (src는 webview URI) */
      fonts: { id: string; src: string; format: string }[]
    }
  }

  /** 작성자 아바타 — GitHub API + 디스크 캐시, 없으면 null (webview가 Gravatar 폴백) */
  getAvatar: {
    params: { repo: string; email: string; commitHash: string }
    result: { dataUri: string | null }
  }

  /** 워킹트리 변경사항 stash 등 이후 확장용 자리 */
  copyToClipboard: { params: { text: string }; result: ActionResult }
}

export type RequestCommand = keyof RequestMap

export interface BridgeRequest<C extends RequestCommand = RequestCommand> {
  kind: 'request'
  id: number
  command: C
  params: RequestMap[C]['params']
}

export type BridgeResponse<C extends RequestCommand = RequestCommand> =
  | { kind: 'response'; id: number; ok: true; result: RequestMap[C]['result'] }
  | { kind: 'response'; id: number; ok: false; error: string }

/** host → webview 단방향 알림 */
export type BridgeEvent =
  | { kind: 'event'; event: 'repoChanged' }
  | { kind: 'event'; event: 'settings'; settings: WebviewSettings }

export interface WebviewSettings {
  initialLoadCommits: number
  loadMoreCommits: number
  dateType: 'author' | 'commit'
  fetchPruneByDefault: boolean
}

export type HostMessage = BridgeResponse | BridgeEvent
export type WebviewMessage = BridgeRequest
