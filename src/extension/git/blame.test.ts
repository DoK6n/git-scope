import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { blameFile, parseBlamePorcelain } from './blame'

// `git blame --porcelain --contents - -- LICENSE` 실제 출력 (작성자만 테스트용으로 바꿈)
const PORCELAIN = [
  '806f220c0396cf4cb678354f306f3c85a683dff5 1 1 3',
  'author Git Scope Test',
  'author-mail <test@gitscope.invalid>',
  'author-time 1787127087',
  'author-tz +0900',
  'committer Git Scope Test',
  'committer-mail <test@gitscope.invalid>',
  'committer-time 1787127087',
  'committer-tz +0900',
  'summary chore: MIT LICENSE 파일 추가',
  'filename LICENSE',
  '\tMIT License',
  '806f220c0396cf4cb678354f306f3c85a683dff5 2 2',
  '\t',
  '806f220c0396cf4cb678354f306f3c85a683dff5 3 3',
  '\tCopyright (c) 2026',
  '0000000000000000000000000000000000000000 4 4 1',
  'author External file (--contents)',
  'author-mail <external.file>',
  'author-time 1792635020',
  'author-tz +0900',
  'committer External file (--contents)',
  'committer-mail <external.file>',
  'committer-time 1792635020',
  'committer-tz +0900',
  'summary Version of LICENSE from standard input',
  'previous 101f78a3baacfc18e11a4ea245ac51f7f9db7d98 LICENSE',
  'filename LICENSE',
  '\tnew line',
  '',
].join('\n')

describe('parseBlamePorcelain', () => {
  it('maps every line to its commit and reuses metadata for repeated hashes', () => {
    const lines = parseBlamePorcelain(PORCELAIN)

    expect(lines).toHaveLength(4)
    expect(lines[0]).toEqual({
      hash: '806f220c0396cf4cb678354f306f3c85a683dff5',
      author: 'Git Scope Test',
      authorEmail: 'test@gitscope.invalid',
      authorTime: 1787127087,
      summary: 'chore: MIT LICENSE 파일 추가',
      uncommitted: false,
    })
    expect(lines[1]).toBe(lines[0])
    expect(lines[2]).toBe(lines[0])
    expect(lines[3]?.uncommitted).toBe(true)
  })

  it('does not treat line contents that look like headers as metadata', () => {
    const lines = parseBlamePorcelain(
      [
        '806f220c0396cf4cb678354f306f3c85a683dff5 1 1 1',
        'author A',
        'summary real',
        'filename f',
        '\tsummary fake',
        '',
      ].join('\n'),
    )
    expect(lines[0]?.summary).toBe('real')
  })
})

describe('blameFile', () => {
  const roots: string[] = []
  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
  })

  function git(cwd: string, ...args: string[]): void {
    execFileSync('git', args, { cwd })
  }

  it('blames unsaved contents with edited lines marked as uncommitted', async () => {
    const root = mkdtempSync(join(tmpdir(), 'git-scope-blame-'))
    roots.push(root)
    git(root, 'init', '--quiet', '-b', 'main')
    git(root, 'config', 'user.name', 'Git Scope Test')
    git(root, 'config', 'user.email', 'test@gitscope.invalid')
    writeFileSync(join(root, 'a.txt'), 'one\ntwo\n')
    git(root, 'add', 'a.txt')
    git(root, 'commit', '--quiet', '-m', 'add a')

    const saved = await blameFile(root, 'a.txt')
    expect(saved.map((line) => line?.summary)).toEqual(['add a', 'add a'])

    const edited = await blameFile(root, 'a.txt', 'one\nchanged\ntwo\n')
    expect(edited.map((line) => line?.uncommitted)).toEqual([false, true, false])
  })

  it('rejects files git does not track', async () => {
    const root = mkdtempSync(join(tmpdir(), 'git-scope-blame-'))
    roots.push(root)
    git(root, 'init', '--quiet', '-b', 'main')
    writeFileSync(join(root, 'untracked.txt'), 'x\n')

    await expect(blameFile(root, 'untracked.txt')).rejects.toThrow()
  })
})
