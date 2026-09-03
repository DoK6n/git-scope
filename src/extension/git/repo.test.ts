import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AUTHOR_STATS_FORMAT } from './parse'
import { authorStatsLogArgs, GitRepo } from './repo'

describe('authorStatsLogArgs', () => {
  it('현재 브랜치는 HEAD 전체 히스토리를 조회해 detached HEAD에서도 동작한다', () => {
    expect(authorStatsLogArgs('currentBranch', 'all')).toEqual([
      'log',
      '--use-mailmap',
      `--format=${AUTHOR_STATS_FORMAT}`,
      'HEAD',
      '--',
    ])
  })

  it('모든 refs와 기간을 명시한다', () => {
    expect(authorStatsLogArgs('allRefs', '90d')).toEqual([
      'log',
      '--use-mailmap',
      `--format=${AUTHOR_STATS_FORMAT}`,
      '--since=90 days ago',
      '--branches',
      '--remotes',
      '--tags',
      'HEAD',
      '--',
    ])
  })

  it('커밋이 없는 저장소는 빈 결과를 반환한다', async () => {
    const root = mkdtempSync(join(tmpdir(), 'git-scope-author-stats-'))
    try {
      execFileSync('git', ['init', '--quiet'], { cwd: root })
      await expect(new GitRepo(root).getAuthorStats('currentBranch', 'all')).resolves.toEqual([])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
