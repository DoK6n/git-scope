import * as fs from 'node:fs'
import * as path from 'node:path'
import type {
  ActionResult,
  AuthorStatsEntry,
  AuthorStatsPeriod,
  AuthorStatsScope,
  BranchPullPlan,
  Commit,
  CommitDetails,
  CommitLineStats,
  GitRef,
  GraphData,
  InProgressOperation,
  InProgressOperationType,
  RemoteCheckoutPlan,
  StashFileChange,
  StashEntry,
  TagDetails,
  Worktree,
} from '@shared-types/domain'
import { execGit, GitError } from './exec'
import {
  countPorcelainEntries,
  AUTHOR_STATS_FORMAT,
  countUnmergedEntries,
  HEAD_UPSTREAM_FORMAT,
  LOG_FORMAT,
  parseLog,
  parseAuthorStats,
  parseHeadUpstream,
  parseNameStatus,
  parseNumstat,
  parseRefs,
  parseStashList,
  parseWorktrees,
  REF_FORMAT,
  STASH_FORMAT,
  stripCommitMessageComments,
} from './parse'
import { calculateCommitLineStats } from './lineStats'
import {
  branchAheadBehindArgs,
  branchPullMetadataArgs,
  parseBranchPullMetadata,
  pullBranchWithoutCheckoutArgs,
} from './branchPull'
import {
  aheadBehindArgs,
  createTrackingBranchArgs,
  localBranchExistsArgs,
  parseAheadBehind,
  pullFastForwardArgs,
  switchLocalBranchArgs,
} from './remoteCheckout'

/** git의 잘 알려진 빈 트리 해시 — 루트 커밋 디프의 베이스로 쓴다 */
export const EMPTY_TREE_HASH = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'

/** 작성자 통계 조회 범위를 Git log 인자로 변환한다. Current branch는 detached HEAD도 포함한다. */
export function authorStatsLogArgs(
  scope: AuthorStatsScope,
  period: AuthorStatsPeriod,
): string[] {
  const since = period === 'all' ? [] : [`--since=${period.slice(0, -1)} days ago`]
  const revisions =
    scope === 'allRefs' ? ['--branches', '--remotes', '--tags', 'HEAD'] : ['HEAD']
  return [
    'log',
    '--use-mailmap',
    `--format=${AUTHOR_STATS_FORMAT}`,
    ...since,
    ...revisions,
    '--',
  ]
}

/** 그래프·뱃지·필터 목록에 노출할 refs를 원격 표시 옵션에 맞춰 고른다. */
export function visibleGraphRefs(
  refs: GitRef[],
  includeRemotes: boolean,
  hideRemoteOnlyBranches: boolean,
): GitRef[] {
  if (!includeRemotes) return refs.filter((ref) => ref.type !== 'remote')
  if (!hideRemoteOnlyBranches) return refs

  const localBranches = new Set(
    refs.filter((ref) => ref.type === 'head').map((ref) => ref.name),
  )
  return refs.filter((ref) => {
    if (ref.type !== 'remote' || !ref.remote) return true
    // origin/HEAD는 브랜치가 아닌 심볼릭 ref이며 기존 표시 의미를 유지한다.
    if (ref.name === `${ref.remote}/HEAD`) return true
    return localBranches.has(ref.name.slice(ref.remote.length + 1))
  })
}

/** 브랜치 표시 옵션을 실제 git log revision 인자로 변환한다. 빈 배열이면 조회 대상이 없다. */
export function graphRevisionArgs(
  branches: string[] | null,
  refs: GitRef[],
  includeRemotes: boolean,
  hideRemoteOnlyBranches: boolean,
): string[] {
  if (branches === null) {
    if (!includeRemotes) return ['--branches', '--tags', 'HEAD']
    if (!hideRemoteOnlyBranches) return ['--branches', '--remotes', '--tags', 'HEAD']
    const visible = visibleGraphRefs(refs, true, true)
      .filter(
        (ref) =>
          ref.type === 'remote' &&
          ref.remote !== undefined &&
          ref.name !== `${ref.remote}/HEAD`,
      )
      .map((ref) => `refs/remotes/${ref.name}`)
    return ['--branches', ...visible, '--tags', 'HEAD']
  }

  if (includeRemotes && !hideRemoteOnlyBranches) return branches
  const visibleNames = new Set(
    visibleGraphRefs(refs, includeRemotes, hideRemoteOnlyBranches).map((ref) => ref.name),
  )
  const hiddenRemoteNames = new Set(
    refs
      .filter((ref) => ref.type === 'remote' && !visibleNames.has(ref.name))
      .map((ref) => ref.name),
  )
  return branches.filter((name) => !hiddenRemoteNames.has(name))
}

/** 리포 하나에 대한 git 명령 실행기 */
export class GitRepo {
  constructor(readonly root: string) {}

  private git(args: string[], allowExitCodes?: number[]): Promise<string> {
    return execGit(args, { cwd: this.root, allowExitCodes })
  }

  /** 액션(상태 변경) 실행 결과를 ActionResult로 감싼다 — stderr를 삼키지 않는다 */
  private async action(args: string[]): Promise<ActionResult> {
    try {
      await this.git(args)
      return { ok: true }
    } catch (e) {
      return this.actionError(e)
    }
  }

  private actionError(error: unknown): ActionResult {
    if (error instanceof GitError) return { ok: false, error: error.stderr.trim() || error.message }
    return { ok: false, error: String(error) }
  }

  // ── 조회 ─────────────────────────────────────────

  async getGraph(
    maxCommits: number,
    branches: string[] | null,
    includeRemotes = true,
    hideRemoteOnlyBranches = false,
  ): Promise<GraphData> {
    const refsPromise = this.git(['for-each-ref', `--format=${REF_FORMAT}`])
    const headHashPromise = this.git(['rev-parse', 'HEAD'], [128])
      .then((value) => (value.startsWith('HEAD') || value === '' ? null : value.trim()))
      .catch(() => null)
    const headBranchPromise = this.git(['symbolic-ref', '--short', '-q', 'HEAD'], [1]).then(
      (value) => value.trim() || null,
    )
    const headUpstreamPromise = this.git([
      'for-each-ref',
      `--format=${HEAD_UPSTREAM_FORMAT}`,
      '--points-at',
      'HEAD',
      'refs/heads',
    ]).catch(() => '')
    const statusPromise = this.git(['status', '--porcelain', '-z'])
    const worktreesPromise = this.listWorktrees().catch(() => [] as Worktree[])
    // 원격 ref를 선별해야 할 때만 refs를 먼저 기다린다. 기본 경로는 log와 refs를 병렬 조회한다.
    const needsRefAwareRevisions =
      hideRemoteOnlyBranches || (!includeRemotes && branches !== null)
    const refsBeforeLog = needsRefAwareRevisions ? await refsPromise : null
    const revisions =
      refsBeforeLog === null
        ? branches === null
          ? ['--branches', ...(includeRemotes ? ['--remotes'] : []), '--tags', 'HEAD']
          : branches
        : graphRevisionArgs(
            branches,
            parseRefs(refsBeforeLog),
            includeRemotes,
            hideRemoteOnlyBranches,
          )
    const [logOut, refsOut, headHash, headBranch, headUpstreamOut, statusOut, worktrees] =
      await Promise.all([
        revisions.length === 0
          ? Promise.resolve('')
          : this.git([
              'log',
              '--date-order',
              `-n`,
              String(maxCommits + 1),
              `--format=${LOG_FORMAT}`,
              ...revisions,
              '--',
            ]).catch((e) => {
              // 커밋이 하나도 없는 리포는 log가 실패한다
              if (
                e instanceof GitError &&
                /does not have any commits|bad revision/i.test(e.stderr)
              )
                return ''
              throw e
            }),
        refsPromise,
        headHashPromise,
        headBranchPromise,
        headUpstreamPromise,
        statusPromise,
        worktreesPromise,
      ])
    const [stashOut, operation] = await Promise.all([
      this.git(['stash', 'list', `--format=${STASH_FORMAT}`]).catch(() => ''),
      this.getInProgressOperation(statusOut),
    ])

    let commits = parseLog(logOut)
    const moreAvailable = commits.length > maxCommits
    if (moreAvailable) commits = commits.slice(0, maxCommits)

    // 스태시를 베이스 커밋 바로 위에 합성 노드로 끼워 넣는다 (베이스가 로드된 경우만)
    for (const stash of parseStashList(stashOut)) {
      const baseIndex = commits.findIndex((c) => c.hash === stash.baseHash)
      if (baseIndex < 0) continue
      commits.splice(baseIndex, 0, {
        hash: stash.hash,
        parents: [stash.baseHash],
        author: stash.author,
        authorEmail: stash.authorEmail,
        authorDate: stash.authorDate,
        commitDate: stash.commitDate,
        subject: stash.subject,
        stashSelector: stash.selector,
      })
    }

    const uncommittedCount = countPorcelainEntries(statusOut)
    // 일반 변경은 브랜치 필터로 HEAD가 빠지면 고아 노드가 되므로 얹지 않는다.
    // 진행 중 작업은 필터와 무관하게 알려야 하므로 행을 유지한다.
    const headLoaded = headHash !== null && commits.some((c) => c.hash === headHash)
    if (
      (uncommittedCount > 0 || operation !== null) &&
      headHash !== null &&
      (headLoaded || operation !== null)
    ) {
      // 워킹트리 변경사항을 HEAD를 부모로 갖는 합성 커밋으로 그래프 맨 위에 얹는다
      const now = Math.floor(Date.now() / 1000)
      const uncommitted: Commit = {
        hash: '*',
        parents: [headHash],
        author: '',
        authorEmail: '',
        authorDate: now,
        commitDate: now,
        subject: `Uncommitted changes (${uncommittedCount})`,
        isUncommitted: true,
      }
      commits = [uncommitted, ...commits]
    }

    return {
      commits,
      refs: visibleGraphRefs(parseRefs(refsOut), includeRemotes, hideRemoteOnlyBranches),
      headHash,
      headBranch,
      headUpstream: parseHeadUpstream(headUpstreamOut),
      uncommittedCount,
      operation,
      moreAvailable,
      worktreeBranches: worktrees
        .filter((w) => !w.isMain && w.branch !== null)
        .map((w) => w.branch as string),
    }
  }

  /**
   * 진행 중인 Git 작업 판정. 경로는 Git이 해석하게 해 linked worktree·서브모듈의
   * 실제 gitdir에 있는 상태 파일/디렉토리를 확인한다.
   */
  private async getInProgressOperation(statusOut: string): Promise<InProgressOperation | null> {
    const [mergeHead, rebaseMerge, rebaseApply, cherryPickHead, revertHead] = await this.gitPaths(
      'MERGE_HEAD',
      'rebase-merge',
      'rebase-apply',
      'CHERRY_PICK_HEAD',
      'REVERT_HEAD',
    )
    const exists = (filePath: string | undefined): Promise<boolean> =>
      filePath === undefined
        ? Promise.resolve(false)
        : fs.promises.stat(filePath).then(
            () => true,
            () => false,
          )
    const [merging, rebaseMergeExists, rebaseApplyExists, cherryPicking, reverting] =
      await Promise.all([
        exists(mergeHead),
        exists(rebaseMerge),
        exists(rebaseApply),
        exists(cherryPickHead),
        exists(revertHead),
      ])

    // rebase는 내부적으로 cherry-pick 상태 파일을 함께 남길 수 있으므로 우선 판정한다.
    let type: InProgressOperationType | null = null
    if (rebaseMergeExists || rebaseApplyExists) type = 'rebase'
    else if (merging) type = 'merge'
    else if (cherryPicking) type = 'cherry-pick'
    else if (reverting) type = 'revert'
    return type === null ? null : { type, conflictCount: countUnmergedEntries(statusOut) }
  }

  async getCommitDetails(hash: string): Promise<CommitDetails> {
    const meta = await this.git([
      'log',
      '-1',
      '--format=%H%x00%P%x00%an%x00%ae%x00%at%x00%cn%x00%ct%x00%B',
      hash,
      '--',
    ])
    const fields = meta.split('\0')
    const parents = fields[1] === '' ? [] : fields[1]!.split(' ')
    const base = parents.length > 0 ? parents[0]! : EMPTY_TREE_HASH
    return {
      hash: fields[0]!,
      parents,
      author: fields[2]!,
      authorEmail: fields[3]!,
      authorDate: Number(fields[4]),
      committer: fields[5]!,
      commitDate: Number(fields[6]),
      body: (fields[7] ?? '').trim(),
      files: await this.diffFiles(base, hash),
    }
  }

  /**
   * 로드된 그래프와 무관한 작성자별 전체 히스토리 집계.
   * %aN/%aE와 --use-mailmap을 함께 써서 설정값과 무관하게 mailmap을 적용한다.
   */
  async getAuthorStats(
    scope: AuthorStatsScope,
    period: AuthorStatsPeriod,
  ): Promise<AuthorStatsEntry[]> {
    try {
      const output = await this.git(authorStatsLogArgs(scope, period))
      return parseAuthorStats(output)
    } catch (e) {
      // unborn HEAD / 커밋이 하나도 없는 저장소는 빈 통계로 표시한다.
      if (e instanceof GitError && /does not have any commits|bad revision|unknown revision/i.test(e.stderr))
        return []
      throw e
    }
  }

  async getComparison(fromHash: string, toHash: string): Promise<CommitDetails> {
    const details = await this.getCommitDetails(toHash)
    return { ...details, files: await this.diffFiles(fromHash, toHash) }
  }

  /** 공백·주석 전용 변경 줄을 근사 제외한 커밋 라인 통계 */
  async getCommitLineStats(baseHash: string | null, hash: string): Promise<CommitLineStats> {
    const base = baseHash ?? EMPTY_TREE_HASH
    const [numstat, patch] = await Promise.all([
      this.git(['diff', '--numstat', '-z', '--find-renames', base, hash, '--']),
      this.git([
        '-c',
        'core.quotePath=false',
        'diff',
        '--no-ext-diff',
        '--no-color',
        '--no-prefix',
        '--unified=0',
        '--find-renames',
        base,
        hash,
        '--',
      ]),
    ])
    const files = [...parseNumstat(numstat)].map(([path, stat]) => ({ path, ...stat }))
    return calculateCommitLineStats(files, patch)
  }

  /** name-status(변경 종류) + numstat(추가/삭제 라인 수)을 합친 파일 목록 */
  private async diffFiles(base: string, target: string): Promise<CommitDetails['files']> {
    const [nameStatus, numstat] = await Promise.all([
      this.git(['diff', '--name-status', '-z', '--find-renames', base, target, '--']),
      this.git(['diff', '--numstat', '-z', '--find-renames', base, target, '--']),
    ])
    const stats = parseNumstat(numstat)
    return parseNameStatus(nameStatus).map((file) => ({
      ...file,
      ...(stats.get(file.path) ?? {}),
    }))
  }

  /** `git show <hash>:<path>` — 디프 뷰용 파일 내용. 없으면 빈 문자열 */
  async showFile(hash: string, path: string): Promise<string> {
    try {
      return await this.git(['show', `${hash}:${path}`])
    } catch {
      return ''
    }
  }

  // ── 기본 액션 (M3) ────────────────────────────────

  checkoutBranch(name: string): Promise<ActionResult> {
    return this.action(['switch', name])
  }

  async getRemoteCheckoutPlan(
    remote: string,
    branch: string,
    localName: string,
  ): Promise<RemoteCheckoutPlan> {
    const localHash = await this.git(localBranchExistsArgs(localName), [1])
    if (localHash.trim() === '') return { localExists: false, ahead: 0, behind: 0 }
    const counts = await this.git(aheadBehindArgs(remote, branch, localName))
    return { localExists: true, ...parseAheadBehind(counts) }
  }

  async checkoutRemoteBranch(
    remote: string,
    branch: string,
    localName: string,
    mode: 'create' | 'checkout-only' | 'checkout-and-pull',
  ): Promise<ActionResult> {
    try {
      // 확인 다이얼로그 뒤 ref가 바뀌었을 수 있으므로, 첫 mutation 전에 다시 판정한다.
      const plan = await this.getRemoteCheckoutPlan(remote, branch, localName)
      if (mode === 'create') {
        if (plan.localExists) {
          return {
            ok: false,
            error: `Local branch "${localName}" now exists. Retry remote checkout to review its ahead/behind state.`,
          }
        }
        return this.action(createTrackingBranchArgs(remote, branch, localName))
      }

      if (!plan.localExists) {
        return {
          ok: false,
          error: `Local branch "${localName}" no longer exists. Retry remote checkout.`,
        }
      }
      if (mode === 'checkout-and-pull' && plan.ahead > 0) {
        return {
          ok: false,
          error: `Automatic pull stopped: local branch "${localName}" is ${plan.ahead} ahead and ${plan.behind} behind ${remote}/${branch}. No branch was checked out or rewritten.`,
        }
      }

      const switched = await this.action(switchLocalBranchArgs(localName))
      if (!switched.ok || mode === 'checkout-only') return switched
      return this.action(pullFastForwardArgs(remote, branch))
    } catch (error) {
      return this.actionError(error)
    }
  }

  checkoutCommit(hash: string): Promise<ActionResult> {
    return this.action(['checkout', hash])
  }

  createBranch(name: string, at: string, checkout: boolean): Promise<ActionResult> {
    return checkout
      ? this.action(['checkout', '-b', name, at])
      : this.action(['branch', name, at])
  }

  deleteBranch(name: string, force: boolean): Promise<ActionResult> {
    return this.action(['branch', force ? '-D' : '-d', name])
  }

  renameBranch(oldName: string, newName: string): Promise<ActionResult> {
    return this.action(['branch', '-m', oldName, newName])
  }

  async merge(target: string, noFf: boolean, squash: boolean): Promise<ActionResult> {
    const args = ['merge']
    if (squash) args.push('--squash')
    else if (noFf) args.push('--no-ff')
    args.push(target)
    const result = await this.action(args)
    if (squash) await this.seedSquashMergeMessage()
    return result
  }

  /**
   * squash 머지 뒤 커밋 메시지 기본값을 채운다.
   *
   * git은 일반 머지의 기본 메시지를 `MERGE_MSG`에 쓰지만, squash 머지는 `SQUASH_MSG`에 쓴다.
   * `git commit`은 둘 다 알아서 읽는 반면 IDE의 소스 제어 입력칸은 `MERGE_MSG`만 읽기 때문에,
   * 그래프에서 squash 머지를 하면 커밋 메시지 칸이 빈 채로 남는다(충돌이 나면 `MERGE_MSG`에
   * 충돌 파일 주석만 들어간다). 터미널에서 커밋할 때와 같은 기본값이 뜨도록 옮겨 적는다.
   */
  private async seedSquashMergeMessage(): Promise<void> {
    try {
      const [squashPath, mergePath] = await this.gitPaths('SQUASH_MSG', 'MERGE_MSG')
      if (squashPath === undefined || mergePath === undefined) return
      const squashMessage = await fs.promises.readFile(squashPath, 'utf8')
      if (squashMessage.trim() === '') return
      const existing = await fs.promises.readFile(mergePath, 'utf8').catch(() => '')
      // 주석이 아닌 줄이 이미 있으면 사용자나 git이 쓴 메시지다 — 덮어쓰지 않는다
      if (stripCommitMessageComments(existing) !== '') return
      const merged =
        existing.trim() === '' ? squashMessage : `${squashMessage.trimEnd()}\n\n${existing}`
      await fs.promises.writeFile(mergePath, merged)
    } catch {
      // 기본 메시지를 못 채워도 머지 자체에는 영향이 없다
    }
  }

  /**
   * `.git` 하위 파일의 실제 경로를 git에게 물어 절대경로로 돌려준다.
   *
   * 경로를 `<root>/.git/<name>`으로 조립하면 안 된다 — worktree·서브모듈·
   * `--separate-git-dir` 저장소에서 `.git`은 디렉토리가 아니라 gitdir 경로가 적힌
   * 파일이므로 그 아래로 내려갈 수 없다(`ENOTDIR`).
   */
  private async gitPaths(...names: string[]): Promise<(string | undefined)[]> {
    const args = ['rev-parse']
    for (const name of names) args.push('--git-path', name)
    const out = await this.git(args)
    return out
      .trim()
      .split('\n')
      .map((line) => (line === '' ? undefined : path.resolve(this.root, line)))
  }

  /**
   * `<root>/.git`이 디렉토리가 아닌지 — 즉 worktree·서브모듈·`--separate-git-dir` 저장소인지.
   *
   * VS Code 내장 git은 머지 상태 파일 경로를 `<root>/.git/<name>`으로 조립하므로
   * 이 값이 true인 저장소에서는 `MERGE_MSG`를 읽지 못한다. 그 경우에만 GitScope가
   * 커밋 메시지 기본값을 소스 제어 입력칸에 직접 넣어 보완한다.
   */
  async usesGitDirFile(): Promise<boolean> {
    return fs.promises.stat(path.join(this.root, '.git')).then(
      (stat) => !stat.isDirectory(),
      () => false,
    )
  }

  /**
   * 지금 커밋하면 기본값으로 쓰일 커밋 메시지. 없으면 null.
   *
   * 내장 git의 `getInputTemplate()`과 같은 우선순위(`MERGE_MSG` → `SQUASH_MSG`)로 읽고,
   * 같은 방식으로 주석 줄을 걷어낸다. `commit.template`은 내장 git이 이 경로와 무관하게
   * 항상 읽으므로 여기서는 다루지 않는다.
   */
  async readPendingCommitMessage(): Promise<string | null> {
    const paths = await this.gitPaths('MERGE_MSG', 'SQUASH_MSG')
    for (const filePath of paths) {
      if (filePath === undefined) continue
      const raw = await fs.promises.readFile(filePath, 'utf8').catch(() => '')
      const message = stripCommitMessageComments(raw)
      if (message !== '') return message
    }
    return null
  }

  createTag(name: string, at: string, message: string | null): Promise<ActionResult> {
    return message === null
      ? this.action(['tag', name, at])
      : this.action(['tag', '-a', name, '-m', message, at])
  }

  deleteTag(name: string): Promise<ActionResult> {
    return this.action(['tag', '-d', name])
  }

  // ── 패리티 보강 (M5) ──────────────────────────────

  cherryPick(
    hash: string,
    noCommit: boolean,
    recordOrigin: boolean,
    isMerge: boolean,
  ): Promise<ActionResult> {
    const args = ['cherry-pick']
    if (noCommit) args.push('--no-commit')
    if (recordOrigin) args.push('-x')
    if (isMerge) args.push('-m', '1')
    args.push(hash)
    return this.action(args)
  }

  revert(hash: string, isMerge: boolean): Promise<ActionResult> {
    const args = ['revert', '--no-edit']
    if (isMerge) args.push('-m', '1')
    args.push(hash)
    return this.action(args)
  }

  /** 커밋 하나를 현재 브랜치 히스토리에서 제거 ⚠️ */
  dropCommit(hash: string): Promise<ActionResult> {
    return this.action(['rebase', '--onto', `${hash}^`, hash])
  }

  /** 워킹트리 변경을 대상 커밋용 fixup 커밋으로 저장 */
  commitFixup(hash: string, includeAll: boolean): Promise<ActionResult> {
    const args = ['commit', `--fixup=${hash}`]
    if (includeAll) args.push('-a')
    return this.action(args)
  }

  /**
   * fixup!/squash! 커밋 자동 배치·병합 ⚠️ — 에디터 없이 자동 배치된 todo를 그대로 적용.
   * GIT_SEQUENCE_EDITOR=':'(no-op)로 interactive rebase를 비대화식으로 통과시킨다.
   */
  async autosquash(baseHash: string): Promise<ActionResult> {
    try {
      // 대상이 루트 커밋이면 <base>^가 없으므로 --root로 전체 범위 rebase
      const hasParent = await this.git(['rev-parse', '--verify', '--quiet', `${baseHash}^`], [1])
        .then((s) => s.trim() !== '')
        .catch(() => false)
      const range = hasParent ? [`${baseHash}^`] : ['--root']
      await execGit(['rebase', '--interactive', '--autosquash', ...range], {
        cwd: this.root,
        env: { GIT_SEQUENCE_EDITOR: ':' },
      })
      return { ok: true }
    } catch (e) {
      if (e instanceof GitError) return { ok: false, error: e.stderr.trim() || e.message }
      return { ok: false, error: String(e) }
    }
  }

  /**
   * 커밋 메시지만 수정 ⚠️ — 내용(tree)·author는 보존.
   * HEAD면 amend --only, 조상 커밋이면 commit-tree로 재작성 후 이후 커밋을 rebase로 재적용.
   */
  async rewordCommit(hash: string, message: string): Promise<ActionResult> {
    try {
      const head = (await this.git(['rev-parse', 'HEAD'])).trim()
      if (head === hash) {
        // --only: 스테이징된 변경을 끌어들이지 않고 메시지만 교체
        return this.action(['commit', '--amend', '--only', '--allow-empty', '-m', message])
      }

      const isAncestor = await this.git(['merge-base', '--is-ancestor', hash, 'HEAD']).then(
        () => true,
        (e) => {
          if (e instanceof GitError && e.exitCode === 1) return false
          throw e
        },
      )
      if (!isAncestor) {
        return {
          ok: false,
          error: '현재 브랜치(HEAD)에서 도달할 수 없는 커밋은 메시지를 수정할 수 없습니다.',
        }
      }

      // 동일 tree·부모·author를 유지한 채 메시지만 바꾼 커밋 객체를 만든다
      const meta = await this.git(['log', '-1', '--format=%T%x00%P%x00%an%x00%ae%x00%aI', hash, '--'])
      const fields = meta.replace(/\n$/, '').split('\0')
      const parents = fields[1] === '' ? [] : fields[1]!.split(' ')
      const args = ['commit-tree', fields[0]!]
      for (const parent of parents) args.push('-p', parent)
      args.push('-m', message)
      const newHash = (
        await execGit(args, {
          cwd: this.root,
          env: {
            GIT_AUTHOR_NAME: fields[2]!,
            GIT_AUTHOR_EMAIL: fields[3]!,
            GIT_AUTHOR_DATE: fields[4]!,
          },
        })
      ).trim()

      // 이후 커밋들을 새 커밋 위로 재적용 — 머지 커밋·빈 커밋 보존
      return this.action(['rebase', '--rebase-merges', '--empty=keep', '--onto', newHash, hash])
    } catch (e) {
      if (e instanceof GitError) return { ok: false, error: e.stderr.trim() || e.message }
      return { ok: false, error: String(e) }
    }
  }

  rebase(target: string): Promise<ActionResult> {
    return this.action(['rebase', target])
  }

  /** source를 target 브랜치로 merge — target이 현재 브랜치가 아니면 먼저 체크아웃한다 */
  async mergeBranchInto(source: string, target: string): Promise<ActionResult> {
    const current = await this.git(['symbolic-ref', '--short', '-q', 'HEAD'], [1])
      .then((s) => s.trim())
      .catch(() => '')
    if (current !== target) {
      const switched = await this.action(['switch', target])
      if (!switched.ok) return switched
    }
    return this.action(['merge', source])
  }

  /** branch를 onto 위로 rebase — git이 branch를 체크아웃하고 재적용한다 ⚠️ */
  rebaseBranchOnto(branch: string, onto: string): Promise<ActionResult> {
    return this.action(['rebase', onto, branch])
  }

  pushBranch(
    name: string,
    remote: string,
    setUpstream: boolean,
    force: boolean,
  ): Promise<ActionResult> {
    const args = ['push']
    if (setUpstream) args.push('--set-upstream')
    if (force) args.push('--force-with-lease')
    args.push(remote, name)
    return this.action(args)
  }

  pullBranch(remote: string, branch: string): Promise<ActionResult> {
    return this.action(['pull', remote, branch])
  }

  pullCurrent(): Promise<ActionResult> {
    return this.action(['pull'])
  }

  async getBranchPullPlan(branch: string): Promise<BranchPullPlan> {
    const metadata = parseBranchPullMetadata(
      await this.git(branchPullMetadataArgs(branch)),
      branch,
    )
    if (!metadata) throw new Error(`Local branch "${branch}" does not exist.`)

    const current = await this.git(['symbolic-ref', '--short', '-q', 'HEAD'], [1])
      .then((value) => value.trim())
      .catch(() => '')
    if (!metadata.upstreamRef) {
      return {
        upstream: null,
        ahead: 0,
        behind: 0,
        worktreePath: metadata.worktreePath,
        isCurrent: current === branch,
      }
    }

    const counts = parseAheadBehind(
      await this.git(branchAheadBehindArgs(branch, metadata.upstreamRef)),
    )
    return {
      upstream: {
        displayName: metadata.upstreamDisplayName!,
        remote: metadata.remote!,
        remoteRef: metadata.remoteRef!,
      },
      ...counts,
      worktreePath: metadata.worktreePath,
      isCurrent: current === branch,
    }
  }

  async pullBranchWithoutCheckout(
    branch: string,
    expectedRemote: string,
    expectedRemoteRef: string,
  ): Promise<ActionResult> {
    try {
      // 확인 이후 ref/upstream/worktree 상태가 바뀌었을 수 있으므로 mutation 직전에 재검사한다.
      const plan = await this.getBranchPullPlan(branch)
      if (!plan.upstream) {
        return { ok: false, error: `Branch "${branch}" has no upstream branch.` }
      }
      if (
        plan.upstream.remote !== expectedRemote ||
        plan.upstream.remoteRef !== expectedRemoteRef
      ) {
        return {
          ok: false,
          error: `The upstream of branch "${branch}" changed. Review the branch and try again.`,
        }
      }
      if (plan.isCurrent) {
        return {
          ok: false,
          error: `Branch "${branch}" is now checked out in the current worktree. Use the regular Pull action instead.`,
        }
      }
      if (plan.worktreePath) {
        return {
          ok: false,
          error: `Branch "${branch}" is checked out in worktree "${plan.worktreePath}" and cannot be updated without checkout there.`,
        }
      }
      if (plan.ahead > 0) {
        return {
          ok: false,
          error: `Fast-forward pull stopped: branch "${branch}" is ${plan.ahead} ahead and ${plan.behind} behind ${plan.upstream.displayName}. No ref was updated.`,
        }
      }
      return this.action(
        pullBranchWithoutCheckoutArgs(
          branch,
          plan.upstream.remote,
          plan.upstream.remoteRef,
        ),
      )
    } catch (error) {
      return this.actionError(error)
    }
  }

  deleteRemoteBranch(remote: string, name: string): Promise<ActionResult> {
    return this.action(['push', remote, '--delete', name])
  }

  fetchIntoLocal(remote: string, remoteBranch: string, localBranch: string): Promise<ActionResult> {
    return this.action(['fetch', remote, `${remoteBranch}:${localBranch}`])
  }

  pushTag(name: string, remote: string): Promise<ActionResult> {
    return this.action(['push', remote, name])
  }

  async getTagDetails(name: string): Promise<TagDetails> {
    const out = await this.git([
      'for-each-ref',
      `refs/tags/${name}`,
      '--format=%(objecttype)%00%(objectname)%00%(*objectname)%00%(taggername)%00%(taggeremail)%00%(taggerdate:unix)%00%(contents)',
    ])
    const fields = out.replace(/\n$/, '').split('\0')
    const isAnnotated = fields[0] === 'tag'
    return {
      name,
      hash: isAnnotated ? fields[2]! : fields[1]!,
      isAnnotated,
      tagger: isAnnotated ? fields[3] : undefined,
      taggerEmail: isAnnotated ? fields[4]?.replace(/[<>]/g, '') : undefined,
      taggerDate: isAnnotated && fields[5] ? Number(fields[5]) : undefined,
      message: isAnnotated ? fields.slice(6).join('\0').trim() : undefined,
    }
  }

  stashApply(selector: string, reinstateIndex: boolean): Promise<ActionResult> {
    const args = ['stash', 'apply']
    if (reinstateIndex) args.push('--index')
    args.push(selector)
    return this.action(args)
  }

  stashPop(selector: string, reinstateIndex: boolean): Promise<ActionResult> {
    const args = ['stash', 'pop']
    if (reinstateIndex) args.push('--index')
    args.push(selector)
    return this.action(args)
  }

  stashDrop(selector: string): Promise<ActionResult> {
    return this.action(['stash', 'drop', selector])
  }

  /** Git에는 stash rename이 없어 tree·parents·작성 정보를 보존한 새 commit을 저장한다. */
  async stashRename(selector: string, message: string): Promise<ActionResult> {
    const index = /^stash@\{(\d+)\}$/.exec(selector)?.[1]
    const trimmed = message.trim()
    if (index === undefined || trimmed === '') {
      return { ok: false, error: `Invalid stash rename: ${selector}` }
    }

    try {
      const stash = (await this.listStashes()).find((entry) => entry.selector === selector)
      if (!stash) return { ok: false, error: `Stash not found: ${selector}` }
      if (trimmed === stash.message) return { ok: true }

      const subject = stash.branch ? `On ${stash.branch}: ${trimmed}` : trimmed
      const original = await this.git(['cat-file', 'commit', stash.hash])
      const headerEnd = original.indexOf('\n\n')
      if (headerEnd < 0) return { ok: false, error: `Invalid stash commit: ${stash.hash}` }
      const renamedCommit = `${original.slice(0, headerEnd)}\n\n${subject}\n`
      const renamedHash = (
        await execGit(['hash-object', '-t', 'commit', '-w', '--stdin'], {
          cwd: this.root,
          stdin: renamedCommit,
        })
      ).trim()
      await this.git(['stash', 'store', '-m', subject, renamedHash])
      try {
        await this.git(['stash', 'drop', `stash@{${Number(index) + 1}}`])
      } catch (error) {
        // 원본 제거 실패 시 방금 만든 맨 위 항목을 지워 rename 전 상태로 복구한다.
        await this.git(['stash', 'drop', 'stash@{0}']).catch(() => '')
        return this.actionError(error)
      }
      return { ok: true }
    } catch (error) {
      return this.actionError(error)
    }
  }

  stashBranch(selector: string, branchName: string): Promise<ActionResult> {
    return this.action(['stash', 'branch', branchName, selector])
  }

  stashPush(message: string, includeUntracked: boolean): Promise<ActionResult> {
    const args = ['stash', 'push']
    if (includeUntracked) args.push('--include-untracked')
    if (message.trim() !== '') args.push('-m', message.trim())
    return this.action(args)
  }

  cleanUntracked(directories: boolean): Promise<ActionResult> {
    return this.action(['clean', '-f', ...(directories ? ['-d'] : [])])
  }

  discardAllChanges(): Promise<ActionResult> {
    return this.action(['reset', '--hard', 'HEAD'])
  }

  // ── 신규 기능 (M4) ────────────────────────────────

  reset(to: string, mode: 'soft' | 'mixed' | 'hard'): Promise<ActionResult> {
    return this.action(['reset', `--${mode}`, to])
  }

  abortOperation(operation: InProgressOperationType): Promise<ActionResult> {
    const commands: Record<InProgressOperationType, string> = {
      merge: 'merge',
      rebase: 'rebase',
      'cherry-pick': 'cherry-pick',
      revert: 'revert',
    }
    return this.action([commands[operation], '--abort'])
  }

  fetch(prune: boolean): Promise<ActionResult> {
    const args = ['fetch', '--all']
    if (prune) args.push('--prune')
    return this.action(args)
  }

  /** 스태시 목록 — 스태시 패널용 (커밋이 없는 리포는 빈 목록) */
  async listStashes(): Promise<StashEntry[]> {
    const out = await this.git(['stash', 'list', `--format=${STASH_FORMAT}`]).catch(() => '')
    const stashes = parseStashList(out)
    if (stashes.length === 0) return stashes
    // 베이스 커밋이 브랜치/태그 어디에서도 도달 불가하면 고아 — 그래프에 표시될 수 없다.
    // 스태시마다 조회하면 스태시 수만큼 git 프로세스가 뜨므로 한 번에 판정한다:
    // `--no-walk`로 조상 추적 없이, 주어진 커밋 중 어떤 ref에서도 도달 불가한 것만 출력된다.
    const bases = [...new Set(stashes.map((stash) => stash.baseHash))]
    const unreachable = await this.git([
      'rev-list',
      '--no-walk',
      ...bases,
      '--not',
      '--branches',
      '--remotes',
      '--tags',
    ]).catch(() => null)
    if (unreachable !== null) {
      const orphans = new Set(unreachable.split('\n').filter((hash) => hash !== ''))
      for (const stash of stashes) stash.isOrphan = orphans.has(stash.baseHash)
    }
    return stashes
  }

  /** 스태시의 tracked/untracked 변경 파일 — 펼친 행에서만 지연 조회한다. */
  async getStashFiles(selector: string): Promise<StashFileChange[]> {
    const args = ['stash', 'show', '--include-untracked', '--find-renames']
    const [nameStatus, numstat, stashHash, baseHash, untrackedHash] = await Promise.all([
      this.git([...args, '--name-status', '-z', selector]),
      this.git([...args, '--numstat', '-z', selector]),
      this.git(['rev-parse', '--verify', selector]),
      this.git(['rev-parse', '--verify', `${selector}^1`]),
      this.git(['rev-parse', '--verify', '--quiet', `${selector}^3`], [1]),
    ])
    const resolvedStashHash = stashHash.trim()
    const resolvedBaseHash = baseHash.trim()
    const resolvedUntrackedHash = untrackedHash.trim()
    const untrackedPaths = new Set(
      resolvedUntrackedHash
        ? (await this.git(['ls-tree', '-r', '--name-only', '-z', resolvedUntrackedHash]))
            .split('\0')
            .filter(Boolean)
        : [],
    )
    const stats = parseNumstat(numstat)
    return parseNameStatus(nameStatus).map((file) => {
      const isUntracked = untrackedPaths.has(file.path)
      return {
        ...file,
        ...(stats.get(file.path) ?? {}),
        hash: isUntracked ? resolvedUntrackedHash : resolvedStashHash,
        baseHash: isUntracked ? EMPTY_TREE_HASH : resolvedBaseHash,
      }
    })
  }

  async listWorktrees(): Promise<Worktree[]> {
    const out = await this.git(['worktree', 'list', '--porcelain', '-z'])
    return parseWorktrees(out, this.root)
  }

  addWorktree(
    path: string,
    branch: string,
    createBranch: boolean,
    startPoint: string | null,
  ): Promise<ActionResult> {
    const args = ['worktree', 'add']
    if (createBranch) {
      args.push('-b', branch, path)
      if (startPoint !== null) args.push(startPoint)
    } else {
      args.push(path, branch)
    }
    return this.action(args)
  }

  removeWorktree(path: string, force: boolean): Promise<ActionResult> {
    const args = ['worktree', 'remove']
    if (force) args.push('--force')
    args.push(path)
    return this.action(args)
  }

  moveWorktree(path: string, newPath: string): Promise<ActionResult> {
    return this.action(['worktree', 'move', path, newPath])
  }

  repairWorktree(path: string): Promise<ActionResult> {
    return this.action(['worktree', 'repair', path])
  }

  lockWorktree(path: string, lock: boolean): Promise<ActionResult> {
    return this.action(['worktree', lock ? 'lock' : 'unlock', path])
  }
}
