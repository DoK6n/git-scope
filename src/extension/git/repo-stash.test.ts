import { execFileSync } from 'node:child_process'
import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { EMPTY_TREE_HASH, GitRepo } from './repo'

describe('GitRepo stash details', () => {
  const tempRepos: string[] = []

  afterEach(() => {
    for (const repo of tempRepos) rmSync(repo, { recursive: true, force: true })
    tempRepos.length = 0
  })

  it('목록에서 생성 브랜치·메시지를 얻고 펼친 행에는 untracked 파일까지 반환한다', async () => {
    const root = mkdtempSync(join(tmpdir(), 'git-scope-stash-'))
    tempRepos.push(root)
    const git = (...args: string[]) => execFileSync('git', args, { cwd: root, stdio: 'pipe' })
    git('init', '-q', '-b', 'main')
    git('config', 'user.name', 'Test')
    git('config', 'user.email', 'test@example.com')
    writeFileSync(join(root, 'tracked.txt'), 'base\n')
    git('add', 'tracked.txt')
    git('commit', '-qm', 'base')
    appendFileSync(join(root, 'tracked.txt'), 'changed\n')
    writeFileSync(join(root, 'untracked.txt'), 'new\n')
    git('stash', 'push', '-u', '-m', 'panel work')

    const repo = new GitRepo(root)
    const stashes = await repo.listStashes()
    expect(stashes).toHaveLength(1)
    expect(stashes[0]).toMatchObject({ branch: 'main', message: 'panel work' })

    const files = await repo.getStashFiles(stashes[0]!.selector)
    const stashHash = git('rev-parse', 'stash@{0}').toString().trim()
    const baseHash = git('rev-parse', 'stash@{0}^1').toString().trim()
    const untrackedHash = git('rev-parse', 'stash@{0}^3').toString().trim()
    expect(files).toEqual([
      { status: 'M', path: 'tracked.txt', additions: 1, deletions: 0, hash: stashHash, baseHash },
      {
        status: 'A',
        path: 'untracked.txt',
        additions: 1,
        deletions: 0,
        hash: untrackedHash,
        baseHash: EMPTY_TREE_HASH,
      },
    ])
  })

  it('기존 내용을 유지한 채 스태시 이름을 바꾸고 목록 맨 위로 이동한다', async () => {
    const root = mkdtempSync(join(tmpdir(), 'git-scope-stash-rename-'))
    tempRepos.push(root)
    const git = (...args: string[]) => execFileSync('git', args, { cwd: root, stdio: 'pipe' })
    git('init', '-q', '-b', 'main')
    git('config', 'user.name', 'Test')
    git('config', 'user.email', 'test@example.com')
    writeFileSync(join(root, 'tracked.txt'), 'base\n')
    git('add', 'tracked.txt')
    git('commit', '-qm', 'base')

    appendFileSync(join(root, 'tracked.txt'), 'first\n')
    git('stash', 'push', '-m', 'first work')
    const firstHash = git('rev-parse', 'stash@{0}').toString().trim()
    appendFileSync(join(root, 'tracked.txt'), 'second\n')
    git('stash', 'push', '-m', 'second work')

    const result = await new GitRepo(root).stashRename('stash@{1}', 'renamed work')

    expect(result).toEqual({ ok: true })
    const stashes = await new GitRepo(root).listStashes()
    expect(stashes).toHaveLength(2)
    expect(stashes[0]).toMatchObject({
      hash: firstHash,
      branch: 'main',
      message: 'renamed work',
    })
    expect(stashes[1]).toMatchObject({ branch: 'main', message: 'second work' })
  })
})
