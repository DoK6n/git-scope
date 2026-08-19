import { describe, expect, it } from 'vitest'
import {
  countPorcelainEntries,
  parseLog,
  parseNameStatus,
  parseRefs,
  parseWorktrees,
} from './parse'

const NUL = '\0'

describe('parseLog', () => {
  it('커밋 레코드를 파싱한다', () => {
    const line = [
      'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
      '1111111111111111111111111111111111111111 2222222222222222222222222222222222222222',
      'Kim Dokyun',
      'dokyun@example.com',
      '1723500000',
      '1723500100',
      'feat: add graph view',
    ].join(NUL)
    const commits = parseLog(line + '\n')
    expect(commits).toHaveLength(1)
    expect(commits[0]).toEqual({
      hash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
      parents: [
        '1111111111111111111111111111111111111111',
        '2222222222222222222222222222222222222222',
      ],
      author: 'Kim Dokyun',
      authorEmail: 'dokyun@example.com',
      authorDate: 1723500000,
      commitDate: 1723500100,
      subject: 'feat: add graph view',
    })
  })

  it('루트 커밋(부모 없음)은 빈 parents', () => {
    const line = ['aaaa', '', 'A', 'a@x', '1', '2', 'root'].join(NUL)
    expect(parseLog(line + '\n')[0]!.parents).toEqual([])
  })

  it('빈 출력이면 빈 배열', () => {
    expect(parseLog('')).toEqual([])
  })
})

describe('parseRefs', () => {
  it('로컬/원격/태그를 구분하고 origin/HEAD는 제외한다', () => {
    const out = [
      ['refs/heads/main', 'aaa', ''].join(NUL),
      ['refs/heads/feature/graph', 'bbb', ''].join(NUL),
      ['refs/remotes/origin/HEAD', 'aaa', ''].join(NUL),
      ['refs/remotes/origin/main', 'aaa', ''].join(NUL),
      ['refs/tags/v1.0.0', 'tagobj', 'ccc'].join(NUL),
      ['refs/tags/v0.1.0-light', 'ddd', ''].join(NUL),
      ['refs/stash', 'eee', ''].join(NUL),
    ].join('\n')
    const refs = parseRefs(out)
    expect(refs).toEqual([
      { name: 'main', hash: 'aaa', type: 'head' },
      { name: 'feature/graph', hash: 'bbb', type: 'head' },
      { name: 'origin/main', hash: 'aaa', type: 'remote', remote: 'origin' },
      // annotated tag는 peeled 해시를 쓴다
      { name: 'v1.0.0', hash: 'ccc', type: 'tag' },
      { name: 'v0.1.0-light', hash: 'ddd', type: 'tag' },
    ])
  })
})

describe('parseNameStatus', () => {
  it('일반 변경과 rename을 파싱한다', () => {
    const out = ['M', 'src/a.ts', 'A', 'src/b.ts', 'R100', 'old/name.ts', 'new/name.ts', 'D', 'gone.ts'].join(NUL) + NUL
    expect(parseNameStatus(out)).toEqual([
      { status: 'M', path: 'src/a.ts' },
      { status: 'A', path: 'src/b.ts' },
      { status: 'R', path: 'new/name.ts', oldPath: 'old/name.ts' },
      { status: 'D', path: 'gone.ts' },
    ])
  })

  it('빈 출력이면 빈 배열', () => {
    expect(parseNameStatus('')).toEqual([])
  })
})

describe('parseNumstat', () => {
  it('일반 변경·rename·바이너리를 파싱한다', async () => {
    const { parseNumstat } = await import('./parse')
    const out =
      '5\t3\tsrc/a.ts' + NUL +
      '10\t0\t' + NUL + 'old/name.ts' + NUL + 'new/name.ts' + NUL +
      '-\t-\timage.png' + NUL
    const map = parseNumstat(out)
    expect(map.get('src/a.ts')).toEqual({ additions: 5, deletions: 3 })
    expect(map.get('new/name.ts')).toEqual({ additions: 10, deletions: 0 })
    expect(map.get('image.png')).toEqual({})
  })

  it('빈 출력이면 빈 맵', async () => {
    const { parseNumstat } = await import('./parse')
    expect(parseNumstat('').size).toBe(0)
  })
})

describe('countPorcelainEntries', () => {
  it('변경 파일 수를 센다 (rename은 1개)', () => {
    const out =
      ' M src/a.ts' + NUL + '?? untracked.txt' + NUL + 'R  new.ts' + NUL + 'old.ts' + NUL
    expect(countPorcelainEntries(out)).toBe(3)
  })

  it('깨끗한 워킹트리면 0', () => {
    expect(countPorcelainEntries('')).toBe(0)
  })
})

describe('parseWorktrees', () => {
  it('porcelain -z 출력을 파싱한다', () => {
    const main = ['worktree /repo', 'HEAD aaa', 'branch refs/heads/main'].join(NUL)
    const wt = ['worktree /repo-wt', 'HEAD bbb', 'branch refs/heads/feature/x'].join(NUL)
    const detached = ['worktree /repo-detached', 'HEAD ccc', 'detached'].join(NUL)
    const out = [main, wt, detached].join(NUL + NUL) + NUL + NUL
    const worktrees = parseWorktrees(out, '/repo')
    expect(worktrees).toEqual([
      { path: '/repo', head: 'aaa', branch: 'main', isMain: true, locked: false },
      { path: '/repo-wt', head: 'bbb', branch: 'feature/x', isMain: false, locked: false },
      { path: '/repo-detached', head: 'ccc', branch: null, isMain: false, locked: false },
    ])
  })
})
