import { execFileSync } from 'node:child_process'
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { GitRepo } from './repo'

const roots: string[] = []

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
}

function configureRepo(root: string): void {
  git(root, 'config', 'user.name', 'Git Scope Test')
  git(root, 'config', 'user.email', 'test@gitscope.invalid')
}

function setupRemote(): { root: string; local: string; remote: string } {
  const root = mkdtempSync(join(tmpdir(), 'git-scope-branch-pull-'))
  roots.push(root)
  const local = join(root, 'local')
  const remote = join(root, 'remote.git')
  git(root, 'init', '--quiet', '--bare', remote)
  git(root, 'init', '--quiet', '-b', 'main', local)
  configureRepo(local)
  git(local, 'remote', 'add', 'origin', remote)
  writeFileSync(join(local, 'tracked.txt'), 'base\n')
  git(local, 'add', 'tracked.txt')
  git(local, 'commit', '--quiet', '-m', 'base')
  git(local, 'push', '--quiet', '-u', 'origin', 'main')
  git(local, 'branch', 'feat/pull')
  git(local, 'push', '--quiet', '-u', 'origin', 'feat/pull')
  return { root, local, remote }
}

function advanceRemote(root: string, remote: string, content: string): void {
  const clone = join(root, `clone-${content}`)
  git(root, 'clone', '--quiet', remote, clone)
  configureRepo(clone)
  git(clone, 'switch', '--quiet', 'feat/pull')
  writeFileSync(join(clone, 'tracked.txt'), `${content}\n`)
  git(clone, 'commit', '--quiet', '-am', content)
  git(clone, 'push', '--quiet', 'origin', 'feat/pull')
}

function rewriteRemote(root: string, remote: string): void {
  const clone = join(root, 'clone-rewritten')
  git(root, 'clone', '--quiet', remote, clone)
  configureRepo(clone)
  git(clone, 'switch', '--quiet', '--orphan', 'rewritten')
  writeFileSync(join(clone, 'tracked.txt'), 'rewritten\n')
  git(clone, 'add', 'tracked.txt')
  git(clone, 'commit', '--quiet', '-m', 'rewritten')
  git(clone, 'push', '--quiet', '--force', 'origin', 'HEAD:feat/pull')
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('pullBranchWithoutCheckout', () => {
  it('fast-forwards only the target ref and leaves HEAD and the working tree untouched', async () => {
    const { root, local, remote } = setupRemote()
    advanceRemote(root, remote, 'remote-ahead')
    git(local, 'fetch', '--quiet', 'origin')
    writeFileSync(join(local, 'untracked.txt'), 'keep me\n')

    const repo = new GitRepo(local)
    const beforeHead = git(local, 'symbolic-ref', '--short', 'HEAD')
    const beforeStatus = git(local, 'status', '--porcelain')
    const plan = await repo.getBranchPullPlan('feat/pull')
    expect(plan).toMatchObject({
      upstream: {
        displayName: 'origin/feat/pull',
        remote: 'origin',
        remoteRef: 'refs/heads/feat/pull',
      },
      ahead: 0,
      behind: 1,
      worktreePath: null,
      isCurrent: false,
    })

    await expect(
      repo.pullBranchWithoutCheckout('feat/pull', 'origin', 'refs/heads/feat/pull'),
    ).resolves.toEqual({ ok: true })
    expect(git(local, 'rev-parse', 'feat/pull')).toBe(git(local, 'rev-parse', 'origin/feat/pull'))
    expect(git(local, 'symbolic-ref', '--short', 'HEAD')).toBe(beforeHead)
    expect(git(local, 'status', '--porcelain')).toBe(beforeStatus)
  })

  it('refuses branches without upstream and diverged branches without moving refs', async () => {
    const { root, local, remote } = setupRemote()
    git(local, 'branch', 'local-only')
    const repo = new GitRepo(local)
    await expect(repo.getBranchPullPlan('local-only')).resolves.toMatchObject({ upstream: null })
    await expect(
      repo.pullBranchWithoutCheckout('local-only', 'origin', 'refs/heads/local-only'),
    ).resolves.toEqual({ ok: false, error: 'Branch "local-only" has no upstream branch.' })

    git(local, 'switch', '--quiet', 'feat/pull')
    writeFileSync(join(local, 'local.txt'), 'local\n')
    git(local, 'add', 'local.txt')
    git(local, 'commit', '--quiet', '-m', 'local ahead')
    git(local, 'switch', '--quiet', 'main')
    advanceRemote(root, remote, 'remote-diverged')
    git(local, 'fetch', '--quiet', 'origin')
    const before = git(local, 'rev-parse', 'feat/pull')

    const plan = await repo.getBranchPullPlan('feat/pull')
    expect(plan).toMatchObject({ ahead: 1, behind: 1 })
    const result = await repo.pullBranchWithoutCheckout(
      'feat/pull',
      'origin',
      'refs/heads/feat/pull',
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('is 1 ahead and 1 behind')
    expect(git(local, 'rev-parse', 'feat/pull')).toBe(before)
  })

  it('refuses a target branch checked out in another worktree', async () => {
    const { root, local } = setupRemote()
    const linked = join(root, 'linked')
    git(local, 'worktree', 'add', '--quiet', linked, 'feat/pull')
    const repo = new GitRepo(local)

    const plan = await repo.getBranchPullPlan('feat/pull')
    expect(plan.worktreePath).toBe(realpathSync(linked))
    const result = await repo.pullBranchWithoutCheckout(
      'feat/pull',
      'origin',
      'refs/heads/feat/pull',
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('checked out in worktree')
  })

  it('surfaces Git stderr when the remote is rewritten after the plan', async () => {
    const { root, local, remote } = setupRemote()
    const repo = new GitRepo(local)
    await expect(repo.getBranchPullPlan('feat/pull')).resolves.toMatchObject({
      ahead: 0,
      behind: 0,
    })
    rewriteRemote(root, remote)
    const before = git(local, 'rev-parse', 'feat/pull')

    const result = await repo.pullBranchWithoutCheckout(
      'feat/pull',
      'origin',
      'refs/heads/feat/pull',
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/non-fast-forward|rejected/i)
    expect(git(local, 'rev-parse', 'feat/pull')).toBe(before)
  })
})
