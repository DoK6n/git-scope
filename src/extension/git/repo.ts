import type {
  ActionResult,
  Commit,
  CommitDetails,
  GraphData,
  StashEntry,
  TagDetails,
  Worktree,
} from '@shared-types/domain'
import { execGit, GitError } from './exec'
import {
  countPorcelainEntries,
  LOG_FORMAT,
  parseLog,
  parseNameStatus,
  parseNumstat,
  parseRefs,
  parseStashList,
  parseWorktrees,
  REF_FORMAT,
  STASH_FORMAT,
} from './parse'

/** git의 잘 알려진 빈 트리 해시 — 루트 커밋 디프의 베이스로 쓴다 */
export const EMPTY_TREE_HASH = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'

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
      if (e instanceof GitError) return { ok: false, error: e.stderr.trim() || e.message }
      return { ok: false, error: String(e) }
    }
  }

  // ── 조회 ─────────────────────────────────────────

  async getGraph(
    maxCommits: number,
    branches: string[] | null,
    includeRemotes = true,
  ): Promise<GraphData> {
    // 필터가 있으면 선택된 브랜치만 — HEAD를 넣으면 체크아웃 브랜치 이력이 항상 섞여
    // 필터가 무력화되므로, HEAD는 전체 표시일 때만 포함한다
    const revisions =
      branches === null
        ? ['--branches', ...(includeRemotes ? ['--remotes'] : []), '--tags', 'HEAD']
        : branches
    const [logOut, refsOut, headHash, headBranch, statusOut, worktrees] = await Promise.all([
      this.git([
        'log',
        '--date-order',
        `-n`,
        String(maxCommits + 1),
        `--format=${LOG_FORMAT}`,
        ...revisions,
        '--',
      ]).catch((e) => {
        // 커밋이 하나도 없는 리포는 log가 실패한다
        if (e instanceof GitError && /does not have any commits|bad revision/i.test(e.stderr)) return ''
        throw e
      }),
      this.git(['for-each-ref', `--format=${REF_FORMAT}`]),
      this.git(['rev-parse', 'HEAD'], [128]).then((s) => (s.startsWith('HEAD') || s === '' ? null : s.trim())).catch(() => null),
      this.git(['symbolic-ref', '--short', '-q', 'HEAD'], [1]).then((s) => s.trim() || null),
      this.git(['status', '--porcelain', '-z']),
      this.listWorktrees().catch(() => [] as Worktree[]),
    ])
    const stashOut = await this.git(['stash', 'list', `--format=${STASH_FORMAT}`]).catch(() => '')

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
    // 브랜치 필터로 HEAD 커밋이 로드되지 않았으면 부모 없는 고아 노드가 되므로 얹지 않는다
    const headLoaded = headHash !== null && commits.some((c) => c.hash === headHash)
    if (uncommittedCount > 0 && headHash !== null && headLoaded) {
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
      refs: parseRefs(refsOut).filter((r) => includeRemotes || r.type !== 'remote'),
      headHash,
      headBranch,
      uncommittedCount,
      moreAvailable,
      worktreeBranches: worktrees
        .filter((w) => !w.isMain && w.branch !== null)
        .map((w) => w.branch as string),
    }
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

  async getComparison(fromHash: string, toHash: string): Promise<CommitDetails> {
    const details = await this.getCommitDetails(toHash)
    return { ...details, files: await this.diffFiles(fromHash, toHash) }
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

  checkoutRemoteBranch(remoteName: string, localName: string): Promise<ActionResult> {
    return this.action(['switch', '-c', localName, '--track', remoteName])
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

  merge(target: string, noFf: boolean, squash: boolean): Promise<ActionResult> {
    const args = ['merge']
    if (squash) args.push('--squash')
    else if (noFf) args.push('--no-ff')
    args.push(target)
    return this.action(args)
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

  fetch(prune: boolean): Promise<ActionResult> {
    const args = ['fetch', '--all']
    if (prune) args.push('--prune')
    return this.action(args)
  }

  /** 스태시 목록 — 스태시 패널용 (커밋이 없는 리포는 빈 목록) */
  async listStashes(): Promise<StashEntry[]> {
    const out = await this.git(['stash', 'list', `--format=${STASH_FORMAT}`]).catch(() => '')
    const stashes = parseStashList(out)
    // 베이스 커밋이 브랜치/태그 어디에서도 도달 불가하면 고아 — 그래프에 표시될 수 없다
    await Promise.all(
      stashes.map(async (stash) => {
        const refs = await this.git([
          'for-each-ref',
          '--count=1',
          '--format=%(refname)',
          '--contains',
          stash.baseHash,
          'refs/heads',
          'refs/remotes',
          'refs/tags',
        ]).catch(() => null)
        if (refs !== null) stash.isOrphan = refs.trim() === ''
      }),
    )
    return stashes
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
