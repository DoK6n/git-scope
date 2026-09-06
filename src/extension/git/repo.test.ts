import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { GitRef } from '@shared-types/domain'
import { AUTHOR_STATS_FORMAT } from './parse'
import { authorStatsLogArgs, GitRepo, graphRevisionArgs, visibleGraphRefs } from './repo'

const refs: GitRef[] = [
  { name: 'main', hash: 'a', type: 'head' },
  { name: 'team/shared', hash: 'b', type: 'head' },
  { name: 'origin/main', hash: 'a', type: 'remote', remote: 'origin' },
  { name: 'origin/team/shared', hash: 'b', type: 'remote', remote: 'origin' },
  { name: 'origin/team/other', hash: 'c', type: 'remote', remote: 'origin' },
  { name: 'upstream/main', hash: 'd', type: 'remote', remote: 'upstream' },
  { name: 'origin/HEAD', hash: 'a', type: 'remote', remote: 'origin' },
  { name: 'v1', hash: 'a', type: 'tag' },
]

describe('원격 전용 브랜치 필터', () => {
  it('로컬 이름이 대응하는 모든 원격과 symbolic HEAD는 남긴다', () => {
    expect(visibleGraphRefs(refs, true, true).map((ref) => ref.name)).toEqual([
      'main',
      'team/shared',
      'origin/main',
      'origin/team/shared',
      'upstream/main',
      'origin/HEAD',
      'v1',
    ])
  })

  it('Show Remote Branches를 끄면 원격 전용 토글과 무관하게 원격을 모두 제외한다', () => {
    expect(visibleGraphRefs(refs, false, false).map((ref) => ref.name)).toEqual([
      'main',
      'team/shared',
      'v1',
    ])
    expect(visibleGraphRefs(refs, false, true).map((ref) => ref.name)).toEqual([
      'main',
      'team/shared',
      'v1',
    ])
  })

  it('Show All은 로컬 전체와 대응 원격만 git log revision에 넣는다', () => {
    expect(graphRevisionArgs(null, refs, true, true)).toEqual([
      '--branches',
      'refs/remotes/origin/main',
      'refs/remotes/origin/team/shared',
      'refs/remotes/upstream/main',
      '--tags',
      'HEAD',
    ])
  })

  it('기존 allowlist에서 숨겨진 원격만 빼고 로컬·대응 원격 선택은 유지한다', () => {
    expect(
      graphRevisionArgs(
        ['main', 'origin/main', 'origin/team/other', 'upstream/main'],
        refs,
        true,
        true,
      ),
    ).toEqual(['main', 'origin/main', 'upstream/main'])
    expect(graphRevisionArgs(['origin/team/other'], refs, true, true)).toEqual([])
  })

  it('원격 전체 표시와 원격 전용 숨김을 모두 끄면 기존 revision 의미를 유지한다', () => {
    const selected = ['main', 'origin/team/other']
    expect(graphRevisionArgs(null, refs, true, false)).toEqual([
      '--branches',
      '--remotes',
      '--tags',
      'HEAD',
    ])
    expect(graphRevisionArgs(selected, refs, true, false)).toBe(selected)
  })

  it('그래프 조회에서 원격 전용 ref와 그 브랜치에만 있는 커밋을 제외한다', async () => {
    const root = mkdtempSync(join(tmpdir(), 'git-scope-hide-remote-only-'))
    const git = (args: string[]) =>
      execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
    try {
      git(['init', '--quiet'])
      git(['config', 'user.name', 'Test User'])
      git(['config', 'user.email', 'test@example.com'])
      writeFileSync(join(root, 'file.txt'), 'base\n')
      git(['add', 'file.txt'])
      git(['commit', '--quiet', '-m', 'base'])
      git(['branch', '-m', 'main'])
      const base = git(['rev-parse', 'HEAD'])
      const tree = git(['rev-parse', 'HEAD^{tree}'])
      const remoteOnly = git(['commit-tree', tree, '-p', base, '-m', 'remote only'])
      git(['update-ref', 'refs/remotes/origin/main', base])
      git(['update-ref', 'refs/remotes/origin/other', remoteOnly])

      const graph = await new GitRepo(root).getGraph(20, null, true, true)

      expect(graph.refs.map((ref) => ref.name)).toContain('origin/main')
      expect(graph.refs.map((ref) => ref.name)).not.toContain('origin/other')
      expect(graph.commits.map((commit) => commit.hash)).not.toContain(remoteOnly)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('개별 브랜치 숨김', () => {
  it('Show All에서도 숨긴 ref와 전용 커밋을 revset에서 제외한다', () => {
    expect(
      graphRevisionArgs(
        null,
        refs,
        true,
        false,
        ['main', 'origin/team/other'],
        'main',
      ),
    ).toEqual([
      'refs/heads/team/shared',
      'refs/remotes/origin/main',
      'refs/remotes/origin/team/shared',
      'refs/remotes/upstream/main',
      '--tags',
    ])
  })

  it('blocklist가 allowlist보다 우선하고 원격 표시 경계도 지킨다', () => {
    expect(
      graphRevisionArgs(
        ['main', 'team/shared', 'origin/team/other'],
        refs,
        true,
        false,
        ['team/shared'],
        'main',
      ),
    ).toEqual(['main', 'origin/team/other'])
    expect(
      graphRevisionArgs(
        ['main', 'origin/team/other'],
        refs,
        false,
        false,
        ['team/shared'],
        'main',
      ),
    ).toEqual(['main'])
  })

  it('원격 전용 필터는 수동 숨김 전의 전체 로컬 ref를 기준으로 짝을 판단한다', () => {
    expect(visibleGraphRefs(refs, true, true, ['main']).map((ref) => ref.name)).toEqual([
      'team/shared',
      'origin/main',
      'origin/team/shared',
      'upstream/main',
      'origin/HEAD',
      'v1',
    ])
  })

  it('숨긴 브랜치의 전용 커밋과 ref badge를 함께 제외한다', async () => {
    const root = mkdtempSync(join(tmpdir(), 'git-scope-hidden-branch-'))
    const git = (...args: string[]) =>
      execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
    try {
      git('init', '--quiet', '--initial-branch=main')
      git('config', 'user.name', 'Test')
      git('config', 'user.email', 'test@example.com')
      writeFileSync(join(root, 'base.txt'), 'base\n')
      git('add', '.')
      git('commit', '--quiet', '-m', 'base')
      git('switch', '--quiet', '-c', 'feature/secret')
      writeFileSync(join(root, 'secret.txt'), 'secret\n')
      git('add', '.')
      git('commit', '--quiet', '-m', 'secret only')
      const secretHash = git('rev-parse', 'HEAD')
      git('switch', '--quiet', 'main')

      const graph = await new GitRepo(root).getGraph(
        100,
        null,
        true,
        false,
        ['feature/secret'],
      )

      expect(graph.refs.map((ref) => ref.name)).not.toContain('feature/secret')
      expect(graph.commits.map((commit) => commit.hash)).not.toContain(secretHash)
      expect(graph.refs.map((ref) => ref.name)).toContain('main')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

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

describe('GitRepo head upstream', () => {
  it('그래프 데이터에 현재 브랜치의 upstream을 포함한다', async () => {
    const root = mkdtempSync(join(tmpdir(), 'git-scope-upstream-'))
    const git = (...args: string[]) => execFileSync('git', args, { cwd: root, stdio: 'pipe' })
    try {
      git('init', '--quiet', '-b', 'main')
      git('config', 'user.name', 'Test')
      git('config', 'user.email', 'test@example.com')
      writeFileSync(join(root, 'README.md'), 'test\n')
      git('add', 'README.md')
      git('commit', '--quiet', '-m', 'initial')
      git('remote', 'add', 'origin', 'https://example.invalid/repo.git')
      git('update-ref', 'refs/remotes/origin/main', 'HEAD')
      git('branch', '--set-upstream-to=origin/main', 'main')

      const graph = await new GitRepo(root).getGraph(10, null)
      expect(graph.headUpstream).toEqual({ remote: 'origin', branch: 'main' })
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
