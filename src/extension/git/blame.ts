import * as fs from 'node:fs'
import * as path from 'node:path'
import { execGit } from './exec'

/** 아직 커밋되지 않은 줄에 git blame이 붙이는 해시 (0으로만 이루어짐) */
const UNCOMMITTED_RE = /^0+$/

export interface BlameCommit {
  hash: string
  author: string
  authorEmail: string
  /** epoch 초 */
  authorTime: number
  summary: string
  uncommitted: boolean
}

/** 파일의 줄 번호(0부터) → 그 줄을 마지막으로 바꾼 커밋 */
export type BlameLines = (BlameCommit | undefined)[]

// SHA-1(40자)과 SHA-256(64자) 저장소 모두 지원
const HEADER_RE = /^([0-9a-f]{40}|[0-9a-f]{64}) \d+ (\d+)(?: \d+)?$/

/**
 * `git blame --porcelain` 출력을 줄별 커밋으로 바꾼다.
 * 커밋 메타데이터는 해시가 처음 나올 때만 출력되므로 해시별로 모아 재사용한다.
 */
export function parseBlamePorcelain(output: string): BlameLines {
  const commits = new Map<string, BlameCommit>()
  const lines: BlameLines = []
  let current: BlameCommit | undefined

  for (const line of output.split('\n')) {
    if (line.startsWith('\t')) continue // 줄 내용

    const header = HEADER_RE.exec(line)
    if (header) {
      const hash = header[1]!
      current = commits.get(hash)
      if (!current) {
        current = {
          hash,
          author: '',
          authorEmail: '',
          authorTime: 0,
          summary: '',
          uncommitted: UNCOMMITTED_RE.test(hash),
        }
        commits.set(hash, current)
      }
      lines[Number(header[2]) - 1] = current
      continue
    }

    if (!current) continue
    const space = line.indexOf(' ')
    const key = space < 0 ? line : line.slice(0, space)
    const value = space < 0 ? '' : line.slice(space + 1)
    switch (key) {
      case 'author':
        current.author = value
        break
      case 'author-mail':
        current.authorEmail = value.replace(/^<|>$/g, '')
        break
      case 'author-time':
        current.authorTime = Number(value)
        break
      case 'summary':
        current.summary = value
        break
    }
  }
  return lines
}

/**
 * 파일 하나의 blame을 구한다. contents를 넘기면 저장되지 않은 편집 내용 기준으로 계산한다.
 * 추적되지 않는 파일 등 git이 거부하면 GitError를 던진다.
 */
export async function blameFile(
  root: string,
  relativePath: string,
  contents?: string,
): Promise<BlameLines> {
  const args = ['blame', '--porcelain']
  if (contents !== undefined) args.push('--contents', '-')
  args.push('--', relativePath)
  const output = await execGit(args, { cwd: root, stdin: contents })
  return parseBlamePorcelain(output)
}

export interface BlameRepo {
  root: string
  /** 이 작업 트리 전용 git 디렉토리 (worktree면 .git/worktrees/<name>) */
  gitDir: string
}

/** 디렉토리가 속한 저장소를 찾는다. git 저장소가 아니면 null */
export async function resolveBlameRepo(dir: string): Promise<BlameRepo | null> {
  try {
    const output = await execGit(['rev-parse', '--show-toplevel', '--absolute-git-dir'], { cwd: dir })
    const [root, gitDir] = output.trim().split('\n')
    return root && gitDir ? { root, gitDir } : null
  } catch {
    return null
  }
}

/**
 * HEAD가 움직였는지 판단할 값. 커밋, 체크아웃, reset, rebase 모두 HEAD reflog를 갱신하므로
 * git을 실행하지 않고 파일 수정 시각만으로 blame 캐시가 낡았는지 알 수 있다.
 */
export async function headStamp(gitDir: string): Promise<number> {
  const times = await Promise.all(
    ['logs/HEAD', 'HEAD'].map((name) =>
      fs.promises.stat(path.join(gitDir, name)).then(
        (stat) => stat.mtimeMs,
        () => 0,
      ),
    ),
  )
  return Math.max(...times)
}
