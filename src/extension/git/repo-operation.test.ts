import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { InProgressOperationType } from '@shared-types/domain'

vi.mock('./exec', () => ({
  execGit: vi.fn(async () => ''),
  GitError: class GitError extends Error {
    stderr = ''
    exitCode = 1
  },
}))

import { execGit } from './exec'
import { GitRepo } from './repo'

describe('GitRepo.abortOperation', () => {
  beforeEach(() => {
    vi.mocked(execGit).mockClear()
    vi.mocked(execGit).mockResolvedValue('')
  })

  it.each<[InProgressOperationType, string]>([
    ['merge', 'merge'],
    ['rebase', 'rebase'],
    ['cherry-pick', 'cherry-pick'],
    ['revert', 'revert'],
  ])('%s 작업에 대응하는 git --abort 인자를 사용한다', async (operation, command) => {
    const repo = new GitRepo('/fake/repo')
    await expect(repo.abortOperation(operation)).resolves.toEqual({ ok: true })
    expect(execGit).toHaveBeenCalledWith([command, '--abort'], {
      cwd: '/fake/repo',
      allowExitCodes: undefined,
    })
  })
})

describe('GitRepo.getGraph 진행 중 작업 판정', () => {
  it.each<[InProgressOperationType, string, 'file' | 'directory']>([
    ['merge', 'MERGE_HEAD', 'file'],
    ['rebase', 'rebase-merge', 'directory'],
    ['rebase', 'rebase-apply', 'directory'],
    ['cherry-pick', 'CHERRY_PICK_HEAD', 'file'],
    ['revert', 'REVERT_HEAD', 'file'],
  ])('git이 해석한 %s 상태 경로와 unmerged 수를 사용한다', async (type, marker, kind) => {
    const gitDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'git-scope-operation-'))
    try {
      const markerPath = path.join(gitDir, marker)
      if (kind === 'directory') await fs.promises.mkdir(markerPath)
      else await fs.promises.writeFile(markerPath, 'head\n')
      const paths = [
        'MERGE_HEAD',
        'rebase-merge',
        'rebase-apply',
        'CHERRY_PICK_HEAD',
        'REVERT_HEAD',
      ]

      vi.mocked(execGit).mockImplementation(async (args) => {
        if (args[0] === 'log')
          return ['head', '', 'Author', 'a@example.com', '1', '1', 'subject', ''].join('\0') + '\n'
        if (args[0] === 'rev-parse' && args[1] === 'HEAD') return 'head\n'
        if (args[0] === 'rev-parse' && args.includes('--git-path'))
          return paths.map((name) => path.join(gitDir, name)).join('\n') + '\n'
        if (args[0] === 'symbolic-ref') return 'main\n'
        if (args[0] === 'status') return 'UU src/conflicted.ts\0 M src/ordinary.ts\0'
        return ''
      })

      const graph = await new GitRepo('/linked/worktree').getGraph(20, null)
      expect(graph.operation).toEqual({ type, conflictCount: 1 })
      expect(execGit).toHaveBeenCalledWith(
        [
          'rev-parse',
          '--git-path',
          'MERGE_HEAD',
          '--git-path',
          'rebase-merge',
          '--git-path',
          'rebase-apply',
          '--git-path',
          'CHERRY_PICK_HEAD',
          '--git-path',
          'REVERT_HEAD',
        ],
        { cwd: '/linked/worktree', allowExitCodes: undefined },
      )
    } finally {
      await fs.promises.rm(gitDir, { recursive: true, force: true })
    }
  })
})
