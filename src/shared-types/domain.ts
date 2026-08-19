/** host↔webview 양쪽에서 공유하는 도메인 타입 */

export interface Commit {
  hash: string
  parents: string[]
  author: string
  authorEmail: string
  /** unix seconds */
  authorDate: number
  /** unix seconds */
  commitDate: number
  subject: string
  /** 워킹트리 변경사항을 나타내는 합성 노드 (그래프 최상단) */
  isUncommitted?: boolean
}

export type RefType = 'head' | 'remote' | 'tag'

export interface GitRef {
  /** 표시명: 브랜치명, remote/브랜치명, 태그명 */
  name: string
  hash: string
  type: RefType
  /** type === 'remote'일 때 원격 이름 (예: origin) */
  remote?: string
}

export interface GraphData {
  commits: Commit[]
  refs: GitRef[]
  /** HEAD 커밋 해시 (빈 리포면 null) */
  headHash: string | null
  /** 체크아웃된 브랜치명 (detached면 null) */
  headBranch: string | null
  /** 워킹트리 변경 파일 수 */
  uncommittedCount: number
  /** 요청한 개수보다 커밋이 더 남아 있는지 */
  moreAvailable: boolean
  /** worktree에 체크아웃되어 있는 브랜치명 목록 (main worktree 제외) */
  worktreeBranches: string[]
}

export type FileChangeStatus = 'A' | 'M' | 'D' | 'R' | 'C' | 'T' | 'U' | 'X'

export interface FileChange {
  status: FileChangeStatus
  path: string
  /** rename/copy일 때 이전 경로 */
  oldPath?: string
  /** 추가된 라인 수 (바이너리면 undefined) */
  additions?: number
  /** 삭제된 라인 수 (바이너리면 undefined) */
  deletions?: number
}

export interface CommitDetails {
  hash: string
  parents: string[]
  author: string
  authorEmail: string
  authorDate: number
  committer: string
  commitDate: number
  body: string
  files: FileChange[]
}

export interface Worktree {
  path: string
  head: string
  /** 체크아웃된 브랜치명 (detached면 null) */
  branch: string | null
  isMain: boolean
  locked: boolean
}

export interface RepoInfo {
  /** 리포 루트 절대 경로 */
  root: string
  /** 표시용 이름 (루트 디렉토리명) */
  name: string
}

export type ActionResult = { ok: true } | { ok: false; error: string }

/**
 * 파일/폴더 아이콘 — 활성 아이콘 테마에서 해석.
 * svg는 webview URI 문자열, 폰트 기반이면 fontChar+fontId(+색/크기)
 */
export interface IconSpec {
  svg?: string
  fontChar?: string
  fontColor?: string
  fontSize?: string
  fontId?: string
}
