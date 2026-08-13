import type {
  ActionResult,
  Commit,
  CommitDetails,
  GraphData,
  Worktree,
} from '@shared-types/domain'
import { execGit, GitError } from './exec'
import {
  countPorcelainEntries,
  LOG_FORMAT,
  parseLog,
  parseNameStatus,
  parseRefs,
  parseWorktrees,
  REF_FORMAT,
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

  async getGraph(maxCommits: number, branches: string[] | null): Promise<GraphData> {
    const [logOut, refsOut, headHash, headBranch, statusOut, worktrees] = await Promise.all([
      this.git([
        'log',
        '--date-order',
        `-n`,
        String(maxCommits + 1),
        `--format=${LOG_FORMAT}`,
        ...(branches === null ? ['--branches', '--remotes', '--tags'] : branches),
        'HEAD',
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

    let commits = parseLog(logOut)
    const moreAvailable = commits.length > maxCommits
    if (moreAvailable) commits = commits.slice(0, maxCommits)

    const uncommittedCount = countPorcelainEntries(statusOut)
    if (uncommittedCount > 0 && headHash !== null) {
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
      refs: parseRefs(refsOut),
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
    const nameStatus = await this.git([
      'diff',
      '--name-status',
      '-z',
      '--find-renames',
      base,
      hash,
      '--',
    ])
    return {
      hash: fields[0]!,
      parents,
      author: fields[2]!,
      authorEmail: fields[3]!,
      authorDate: Number(fields[4]),
      committer: fields[5]!,
      commitDate: Number(fields[6]),
      body: (fields[7] ?? '').trim(),
      files: parseNameStatus(nameStatus),
    }
  }

  async getComparison(fromHash: string, toHash: string): Promise<CommitDetails> {
    const details = await this.getCommitDetails(toHash)
    const nameStatus = await this.git([
      'diff',
      '--name-status',
      '-z',
      '--find-renames',
      fromHash,
      toHash,
      '--',
    ])
    return { ...details, files: parseNameStatus(nameStatus) }
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
    return this.action(['checkout', name])
  }

  checkoutRemoteBranch(remoteName: string, localName: string): Promise<ActionResult> {
    return this.action(['checkout', '-b', localName, '--track', remoteName])
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

  // ── 신규 기능 (M4) ────────────────────────────────

  reset(to: string, mode: 'soft' | 'mixed' | 'hard'): Promise<ActionResult> {
    return this.action(['reset', `--${mode}`, to])
  }

  fetch(prune: boolean): Promise<ActionResult> {
    const args = ['fetch', '--all']
    if (prune) args.push('--prune')
    return this.action(args)
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
}
