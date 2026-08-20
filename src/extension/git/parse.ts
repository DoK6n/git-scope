import type {
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

/** for-each-ref 포맷: refname, 해시, (태그면) 참조 대상 해시. for-each-ref는 %00 문법을 쓴다 */
export const REF_FORMAT = '%(refname)%00%(objectname)%00%(*objectname)'

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
      const name = refname.slice('refs/remotes/'.length)
      // origin/HEAD 같은 심볼릭 참조는 제외
      if (name.endsWith('/HEAD')) continue
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

/** `git stash list --format=STASH_FORMAT` 출력 파싱 */
export function parseStashList(output: string): StashEntry[] {
  const stashes: StashEntry[] = []
  for (const line of output.split('\n')) {
    if (line === '') continue
    const fields = line.split(NUL)
    if (fields.length < 8) continue
    const parents = fields[2] === '' ? [] : fields[2]!.split(' ')
    if (parents.length === 0) continue
    stashes.push({
      hash: fields[0]!,
      selector: fields[1]!,
      baseHash: parents[0]!,
      author: fields[3]!,
      authorEmail: fields[4]!,
      authorDate: Number(fields[5]),
      commitDate: Number(fields[6]),
      subject: fields.slice(7).join(NUL),
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
