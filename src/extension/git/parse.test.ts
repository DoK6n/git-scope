import { describe, expect, it } from 'vitest'
import {
  countPorcelainEntries,
  parseAuthorStats,
  countUnmergedEntries,
  parseLog,
  parseNameStatus,
  parseRefs,
  parseWorktrees,
  stripCommitMessageComments,
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

  it('Co-authored-by 트레일러를 파싱한다', () => {
    const line = [
      'aaaa', 'pppp', 'A', 'a@x', '1', '2', 'feat: pair work',
      'Claude Fable 5 <noreply@anthropic.com>\x01Kim Dokyun <dokyun@example.com>',
    ].join(NUL)
    const commits = parseLog(line + '\n')
    expect(commits[0]!.coAuthors).toEqual([
      { name: 'Claude Fable 5', email: 'noreply@anthropic.com' },
      { name: 'Kim Dokyun', email: 'dokyun@example.com' },
    ])
  })

  it('트레일러가 없으면 coAuthors는 undefined', () => {
    const line = ['aaaa', '', 'A', 'a@x', '1', '2', 'no trailer', ''].join(NUL)
    expect(parseLog(line + '\n')[0]!.coAuthors).toBeUndefined()
  })

  it('루트 커밋(부모 없음)은 빈 parents', () => {
    const line = ['aaaa', '', 'A', 'a@x', '1', '2', 'root'].join(NUL)
    expect(parseLog(line + '\n')[0]!.parents).toEqual([])
  })

  it('빈 출력이면 빈 배열', () => {
    expect(parseLog('')).toEqual([])
  })
})

describe('parseAuthorStats', () => {
  it('mailmap 정규 이메일 기준으로 합치고 커밋 수 순으로 정렬한다', () => {
    const output = [
      ['Kim Dokyun', 'dokyun@example.com'].join(NUL),
      ['Kim D.', 'DOKYUN@example.com'].join(NUL),
      ['Alice', 'alice@example.com'].join(NUL),
      ['Bob', 'bob@example.com'].join(NUL),
    ].join('\n')

    expect(parseAuthorStats(output)).toEqual([
      { name: 'Kim Dokyun', email: 'dokyun@example.com', commits: 2 },
      { name: 'Alice', email: 'alice@example.com', commits: 1 },
      { name: 'Bob', email: 'bob@example.com', commits: 1 },
    ])
  })

  it('빈 출력이면 빈 통계다', () => {
    expect(parseAuthorStats('')).toEqual([])
  })
})

describe('parseRefs', () => {
  it('로컬/원격/태그를 구분하고 origin/HEAD도 원격 참조로 포함한다', () => {
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
      { name: 'origin/HEAD', hash: 'aaa', type: 'remote', remote: 'origin' },
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

describe('countUnmergedEntries', () => {
  it('실제 porcelain v1 상태 코드 중 unmerged 파일만 센다', () => {
    const out = [
      'UU src/both-modified.ts',
      'AA src/both-added.ts',
      'DU src/deleted-by-us.ts',
      ' M src/ordinary.ts',
      '?? untracked.txt',
    ].join(NUL) + NUL
    expect(countUnmergedEntries(out)).toBe(3)
  })

  it('충돌이 없으면 0', () => {
    expect(countUnmergedEntries(' M src/a.ts\0A  src/b.ts\0')).toBe(0)
  })
})

describe('parseStashList', () => {
  it('stash 항목을 파싱한다', async () => {
    const { parseStashList } = await import('./parse')
    const line = [
      'aaaa1111',
      'stash@{0}',
      'base1111 index2222',
      'Kim',
      'k@x',
      '1723500000',
      '1723500000',
      'WIP on main: 1234 feat',
    ].join(NUL)
    const stashes = parseStashList(line + '\n')
    expect(stashes).toHaveLength(1)
    expect(stashes[0]).toMatchObject({
      hash: 'aaaa1111',
      selector: 'stash@{0}',
      baseHash: 'base1111',
      subject: 'WIP on main: 1234 feat',
      branch: 'main',
      message: '1234 feat',
    })
  })

  it('사용자 메시지와 비표준 stash 제목을 표시 정보로 분리한다', async () => {
    const { parseStashSubject } = await import('./parse')
    expect(parseStashSubject('On feature/panel: keep local work')).toEqual({
      branch: 'feature/panel',
      message: 'keep local work',
    })
    expect(parseStashSubject('Created via git stash store')).toEqual({
      branch: null,
      message: 'Created via git stash store',
    })
  })

  it('빈 출력이면 빈 배열', async () => {
    const { parseStashList } = await import('./parse')
    expect(parseStashList('')).toEqual([])
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

describe('stripCommitMessageComments', () => {
  it('충돌 머지의 MERGE_MSG에서 제목만 남긴다', () => {
    // git merge 충돌 시 실제로 기록되는 내용
    const raw = "Merge branch 'feature'\n\n# Conflicts:\n#\tsrc/app.ts\n#\tsrc/util.ts\n"
    expect(stripCommitMessageComments(raw)).toBe("Merge branch 'feature'")
  })

  it('squash 머지의 SQUASH_MSG 본문을 보존한다', () => {
    const raw = [
      'Squashed commit of the following:',
      '',
      'commit 7174b92b484da667dab464d9dffdc4887612e8d4',
      'Author: Kim Dokyun <dokyun@example.com>',
      '',
      '    refactor: 응답에서 필요한 필드만 추출',
      '',
    ].join('\n')
    const result = stripCommitMessageComments(raw)
    expect(result.startsWith('Squashed commit of the following:')).toBe(true)
    expect(result).toContain('refactor: 응답에서 필요한 필드만 추출')
  })

  it('주석만 있는 파일은 빈 문자열이 된다 — squash 충돌 시의 MERGE_MSG', () => {
    expect(stripCommitMessageComments('\n# Conflicts:\n#\tuser.srv.ts\n')).toBe('')
  })

  it('들여쓴 주석도 제거하지만 본문의 # 는 남긴다', () => {
    expect(stripCommitMessageComments('  # 주석\nfix: #123 처리\n')).toBe('fix: #123 처리')
  })

  it('빈 입력은 빈 문자열', () => {
    expect(stripCommitMessageComments('')).toBe('')
    expect(stripCommitMessageComments('\n\n  \n')).toBe('')
  })
})
