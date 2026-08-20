import { spawn } from 'node:child_process'

export class GitError extends Error {
  constructor(
    readonly args: string[],
    readonly exitCode: number,
    readonly stderr: string,
  ) {
    super(stderr.trim() || `git ${args.join(' ')} exited with code ${exitCode}`)
    this.name = 'GitError'
  }
}

export interface ExecOptions {
  cwd: string
  /** 0 이외 종료 코드를 허용할 목록 (예: symbolic-ref detached) */
  allowExitCodes?: number[]
  /** 추가 환경변수 (예: commit-tree의 GIT_AUTHOR_*) */
  env?: Record<string, string>
}

/** 실행된 git 명령을 기록할 로거 — main에서 Output 채널로 연결한다 */
let commandLogger: ((line: string) => void) | null = null

export function setGitCommandLogger(logger: ((line: string) => void) | null): void {
  commandLogger = logger
}

/** 로그 한 줄에 넣을 수 있게 인자를 인용·이스케이프하고 길면 줄인다 */
function formatArg(arg: string): string {
  let display = arg.replace(/\r?\n/g, '\\n')
  if (display.length > 120) display = `${display.slice(0, 120)}…`
  return /[\s"'\\$`]/.test(display) ? `'${display.replace(/'/g, String.raw`'\''`)}'` : display
}

function logCommand(args: string[], opts: ExecOptions, exitCode: number, ms: number, stderr: string): void {
  if (!commandLogger) return
  const time = new Date().toTimeString().slice(0, 8)
  const status = exitCode === 0 ? '' : ` (exit ${exitCode})`
  commandLogger(`[${time}] git ${args.map(formatArg).join(' ')}${status} — ${ms}ms · ${opts.cwd}`)
  if (exitCode !== 0 && !opts.allowExitCodes?.includes(exitCode) && stderr.trim() !== '') {
    for (const line of stderr.trim().split('\n')) commandLogger(`    ${line}`)
  }
}

/**
 * git을 직접 spawn해서 stdout을 문자열로 돌려준다.
 * 실패(허용되지 않은 exit code) 시 stderr를 담은 GitError를 던진다.
 */
export function execGit(args: string[], opts: ExecOptions): Promise<string> {
  const startedAt = Date.now()
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, {
      cwd: opts.cwd,
      env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', ...opts.env },
    })

    const stdout: Buffer[] = []
    const stderr: Buffer[] = []
    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk))
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk))

    child.on('error', reject)
    child.on('close', (code) => {
      const exitCode = code ?? -1
      const stderrText = Buffer.concat(stderr).toString('utf8')
      logCommand(args, opts, exitCode, Date.now() - startedAt, stderrText)
      if (exitCode === 0 || opts.allowExitCodes?.includes(exitCode)) {
        resolve(Buffer.concat(stdout).toString('utf8'))
      } else {
        reject(new GitError(args, exitCode, stderrText))
      }
    })
  })
}
