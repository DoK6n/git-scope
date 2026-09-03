import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { GitRepo } from './repo'

describe('GitRepo.pullCurrent', () => {
  const roots: string[] = []

  afterEach(() => {
    for (const root of roots) rmSync(root, { recursive: true, force: true })
    roots.length = 0
  })

  function setup() {
    const root = mkdtempSync(join(tmpdir(), 'git-scope-pull-'))
    roots.push(root)
    const remote = join(root, 'remote.git')
    const local = join(root, 'local')
    const peer = join(root, 'peer')
    const run = (cwd: string, ...args: string[]) =>
      execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()

    run(root, 'init', '--quiet', '--bare', '--initial-branch=main', remote)
    run(root, 'clone', '--quiet', remote, local)
    run(local, 'config', 'user.name', 'Local')
    run(local, 'config', 'user.email', 'local@example.com')
    writeFileSync(join(local, 'shared.txt'), 'base\n')
    run(local, 'add', 'shared.txt')
    run(local, 'commit', '--quiet', '-m', 'base')
    run(local, 'push', '--quiet', '--set-upstream', 'origin', 'main')
    run(root, 'clone', '--quiet', remote, peer)
    run(peer, 'config', 'user.name', 'Peer')
    run(peer, 'config', 'user.email', 'peer@example.com')
    return { local, peer, run }
  }

  it('configured upstream에서 fast-forward한다', async () => {
    const { local, peer, run } = setup()
    writeFileSync(join(peer, 'peer.txt'), 'peer\n')
    run(peer, 'add', 'peer.txt')
    run(peer, 'commit', '--quiet', '-m', 'peer')
    run(peer, 'push', '--quiet')
    const remoteHead = run(peer, 'rev-parse', 'HEAD')

    await expect(new GitRepo(local).pullCurrent()).resolves.toEqual({ ok: true })
    expect(run(local, 'rev-parse', 'HEAD')).toBe(remoteHead)
  })

  it('충돌을 되돌리지 않고 Git stderr와 merge 상태를 남긴다', async () => {
    const { local, peer, run } = setup()
    run(local, 'config', 'pull.rebase', 'false')
    writeFileSync(join(local, 'shared.txt'), 'local\n')
    run(local, 'commit', '--quiet', '-am', 'local')
    const localHead = run(local, 'rev-parse', 'HEAD')
    writeFileSync(join(peer, 'shared.txt'), 'peer\n')
    run(peer, 'commit', '--quiet', '-am', 'peer')
    run(peer, 'push', '--quiet')

    const result = await new GitRepo(local).pullCurrent()

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).not.toBe('')
    expect(run(local, 'rev-parse', 'HEAD')).toBe(localHead)
    expect(run(local, 'rev-parse', '--verify', 'MERGE_HEAD')).not.toBe('')
  })
})
