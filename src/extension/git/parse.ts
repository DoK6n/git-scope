import type {
  AuthorStatsEntry,
  BranchUpstream,
  Commit,
  FileChange,
  FileChangeStatus,
  GitRef,
  StashEntry,
  Worktree,
} from '@shared-types/domain'

const NUL = '\0'

/**
 * git log --format에 쓰는 포맷 문자열. 필드는 NUL로 구분, 레코드는 개행.
 * 마지막 필드는 Co-authored-by 트레일러 값들 (\x01 구분)
 */
export const LOG_FORMAT =
  '%H%x00%P%x00%an%x00%ae%x00%at%x00%ct%x00%s%x00%(trailers:key=Co-authored-by,valueonly=true,separator=%x01)'

/** "Name <email>" 형태의 트레일러 값 파싱 */
function parseCoAuthors(raw: string | undefined): Commit['coAuthors'] {
  if (!raw) return undefined
  const coAuthors: NonNullable<Commit['coAuthors']> = []
  for (const value of raw.split('\x01')) {
    const match = /^(.*)<([^<>]+)>\s*$/.exec(value.trim())
    if (match) coAuthors.push({ name: match[1]!.trim(), email: match[2]!.trim() })
  }
  return coAuthors.length > 0 ? coAuthors : undefined
}

/** `git log --format=LOG_FORMAT` 출력 파싱 */
export function parseLog(output: string): Commit[] {
  const commits: Commit[] = []
  for (const line of output.split('\n')) {
    if (line === '') continue
    const fields = line.split(NUL)
    if (fields.length < 7) continue
    const [hash, parents, author, authorEmail, authorDate, commitDate, subject] = fields
    commits.push({
      hash: hash!,
      parents: parents === '' ? [] : parents!.split(' '),
      author: author!,
      authorEmail: authorEmail!,
      authorDate: Number(authorDate),
      commitDate: Number(commitDate),
      subject: subject ?? '',
      coAuthors: parseCoAuthors(fields[7]),
    })
  }
  return commits
}

/** 작성자 통계용 `git log --format` — mailmap 적용 필드 사용 */
export const AUTHOR_STATS_FORMAT = '%H%x00%aN%x00%aE'

/** 정규 이메일 기준으로 작성자를 합치고 커밋 수 내림차순으로 정렬한다. */
export function parseAuthorStats(output: string): AuthorStatsEntry[] {
  const byEmail = new Map<string, AuthorStatsEntry>()
  for (const line of output.split('\n')) {
    if (line === '') continue
    const [commitHash = '', name = '', email = ''] = line.split(NUL)
    const key = email !== '' ? email.toLowerCase() : `name:${name.toLowerCase()}`
    const existing = byEmail.get(key)
    if (existing) existing.commits++
    else byEmail.set(key, { name, email, commits: 1, commitHash })
  }
  return [...byEmail.values()].sort(
    (a, b) => b.commits - a.commits || a.name.localeCompare(b.name) || a.email.localeCompare(b.email),
  )
}

/** for-each-ref 포맷: refname, 해시, (태그면) 참조 대상 해시. for-each-ref는 %00 문법을 쓴다 */
export const REF_FORMAT = '%(refname)%00%(objectname)%00%(*objectname)'

/** 현재 브랜치와 upstream 원격/브랜치를 한 번에 읽는 for-each-ref 포맷. */
export const HEAD_UPSTREAM_FORMAT = '%(HEAD)%00%(upstream:remotename)%00%(upstream:remoteref)'

export function parseHeadUpstream(output: string): BranchUpstream | null {
  for (const line of output.split('\n')) {
    const [head, remote, remoteRef] = line.split(NUL)
    if (head?.trim() !== '*' || !remote || !remoteRef) continue
    const prefix = 'refs/heads/'
    return {
      remote,
      branch: remoteRef.startsWith(prefix) ? remoteRef.slice(prefix.length) : remoteRef,
    }
  }
  return null
}

/** `git for-each-ref --format=REF_FORMAT` 출력 파싱 */
export function parseRefs(output: string): GitRef[] {
  const refs: GitRef[] = []
  for (const line of output.split('\n')) {
    if (line === '') continue
    const [refname, objectname, peeled] = line.split(NUL)
    if (!refname || !objectname) continue

    if (refname.startsWith('refs/heads/')) {
      refs.push({ name: refname.slice('refs/heads/'.length), hash: objectname, type: 'head' })
    } else if (refname.startsWith('refs/remotes/')) {
      // origin/HEAD 같은 심볼릭 참조도 포함한다 — 그래프에 뱃지로 표시 (원본 showRemoteHeads 기본 동작)
      const name = refname.slice('refs/remotes/'.length)
      const remote = name.split('/')[0]!
      refs.push({ name, hash: objectname, type: 'remote', remote })
    } else if (refname.startsWith('refs/tags/')) {
      refs.push({
        name: refname.slice('refs/tags/'.length),
        // annotated tag는 태그 오브젝트가 아니라 가리키는 커밋 해시를 쓴다
        hash: peeled || objectname,
        type: 'tag',
      })
    }
  }
  return refs
}

/**
 * `git diff --name-status -z` / `git diff-tree -r --name-status -z` 출력 파싱.
 * 레코드: STATUS NUL path (NUL path2 — rename/copy일 때)
 */
export function parseNameStatus(output: string): FileChange[] {
  const parts = output.split(NUL)
  const files: FileChange[] = []
  let i = 0
  while (i < parts.length) {
    const status = parts[i]
    if (!status) break
    const statusChar = status[0] as FileChangeStatus
    if (statusChar === 'R' || statusChar === 'C') {
      const oldPath = parts[i + 1]
      const path = parts[i + 2]
      if (oldPath === undefined || path === undefined) break
      files.push({ status: statusChar, path, oldPath })
      i += 3
    } else {
      const path = parts[i + 1]
      if (path === undefined) break
      files.push({ status: statusChar, path })
      i += 2
    }
  }
  return files
}

export interface NumstatEntry {
  additions?: number
  deletions?: number
}

/**
 * `git diff --numstat -z` 출력 파싱 → 새 경로 기준 맵.
 * 레코드: "A\tD\tpath NUL" / rename이면 "A\tD\t NUL oldpath NUL newpath NUL".
 * 바이너리 파일은 "-\t-" → additions/deletions 없음.
 */
export function parseNumstat(output: string): Map<string, NumstatEntry> {
  const result = new Map<string, NumstatEntry>()
  const parts = output.split(NUL)
  let i = 0
  while (i < parts.length) {
    const record = parts[i]
    if (!record) break
    const [added, deleted, inlinePath] = record.split('\t')
    if (added === undefined || deleted === undefined) break
    const entry: NumstatEntry =
      added === '-'
        ? {}
        : { additions: Number(added), deletions: Number(deleted) }
    if (inlinePath !== undefined && inlinePath !== '') {
      result.set(inlinePath, entry)
      i += 1
    } else {
      // rename: 다음 두 필드가 old/new 경로
      const newPath = parts[i + 2]
      if (newPath === undefined) break
      result.set(newPath, entry)
      i += 3
    }
  }
  return result
}

/** stash list --format 문자열 (LOG_FORMAT + %gd 셀렉터) */
export const STASH_FORMAT = '%H%x00%gd%x00%P%x00%an%x00%ae%x00%at%x00%ct%x00%s'

/** git이 만드는 "WIP on <branch>: …" / "On <branch>: …" 제목을 표시 정보로 분리한다. */
export function parseStashSubject(subject: string): { branch: string | null; message: string } {
  const match = /^(?:WIP on|On) ([^:]+):\s?(.*)$/.exec(subject)
  return match
    ? { branch: match[1]!, message: match[2]! }
    : { branch: null, message: subject }
}

/** `git stash list --format=STASH_FORMAT` 출력 파싱 */
export function parseStashList(output: string): StashEntry[] {
  const stashes: StashEntry[] = []
  for (const line of output.split('\n')) {
    if (line === '') continue
    const fields = line.split(NUL)
    if (fields.length < 8) continue
    const parents = fields[2] === '' ? [] : fields[2]!.split(' ')
    if (parents.length === 0) continue
    const subject = fields.slice(7).join(NUL)
    stashes.push({
      hash: fields[0]!,
      selector: fields[1]!,
      baseHash: parents[0]!,
      author: fields[3]!,
      authorEmail: fields[4]!,
      authorDate: Number(fields[5]),
      commitDate: Number(fields[6]),
      subject,
      ...parseStashSubject(subject),
    })
  }
  return stashes
}

/** `git status --porcelain -z` 출력에서 변경 파일 수를 센다 */
export function countPorcelainEntries(output: string): number {
  let count = 0
  const parts = output.split(NUL)
  for (let i = 0; i < parts.length; i++) {
    const entry = parts[i]
    if (!entry) continue
    count++
    // rename 레코드(R  new -> old)는 다음 NUL 필드가 이전 경로라서 건너뛴다
    if (entry.startsWith('R') || entry.startsWith('C')) i++
  }
  return count
}

/** `git status --porcelain -z` 출력에서 unmerged 상태인 파일 수를 센다. */
export function countUnmergedEntries(output: string): number {
  const unmerged = new Set(['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU'])
  let count = 0
  const parts = output.split(NUL)
  for (let i = 0; i < parts.length; i++) {
    const entry = parts[i]
    if (!entry) continue
    if (unmerged.has(entry.slice(0, 2))) count++
    // rename/copy는 다음 NUL 필드가 이전 경로다
    if (entry.startsWith('R') || entry.startsWith('C')) i++
  }
  return count
}

/**
 * 커밋 메시지 파일(`MERGE_MSG`, `SQUASH_MSG`, `COMMIT_EDITMSG`)에서 주석 줄을 걷어낸다.
 *
 * `git commit`이 에디터 내용을 정리하는 것과 같은 처리다. 충돌이 나면 git이 `MERGE_MSG`에
 * `# Conflicts:` 목록을 붙이는데, 그것만 남은 파일은 걷어내면 빈 문자열이 되므로 "기본
 * 메시지 없음"으로 판정할 수 있다.
 *
 * `core.commentChar`는 지원하지 않는다 — 기본값 `#`만 주석으로 본다. 내장 git도 같은
 * 제약을 갖고 있어 동작을 일치시킨다.
 */
export function stripCommitMessageComments(message: string): string {
  return message.replace(/^\s*#.*$\n?/gm, '').trim()
}

/** `git worktree list --porcelain -z` 출력 파싱 */
export function parseWorktrees(output: string, mainRoot: string): Worktree[] {
  const worktrees: Worktree[] = []
  // porcelain 출력은 worktree 단위 블록. -z면 각 라인이 NUL 종료, 블록 사이 빈 라인(NUL 2개)
  const blocks = output.split(NUL + NUL)
  for (const block of blocks) {
    if (block.trim() === '') continue
    let path = ''
    let head = ''
    let branch: string | null = null
    let locked = false
    let bare = false
    for (const line of block.split(NUL)) {
      if (line.startsWith('worktree ')) path = line.slice('worktree '.length)
      else if (line.startsWith('HEAD ')) head = line.slice('HEAD '.length)
      else if (line.startsWith('branch ')) {
        const ref = line.slice('branch '.length)
        branch = ref.startsWith('refs/heads/') ? ref.slice('refs/heads/'.length) : ref
      } else if (line === 'detached') branch = null
      else if (line === 'bare') bare = true
      else if (line === 'locked' || line.startsWith('locked ')) locked = true
    }
    if (path === '' || bare) continue
    worktrees.push({ path, head, branch, isMain: path === mainRoot, locked })
  }
  return worktrees
}
