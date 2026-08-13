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
}

/**
 * git을 직접 spawn해서 stdout을 문자열로 돌려준다.
 * 실패(허용되지 않은 exit code) 시 stderr를 담은 GitError를 던진다.
 */
export function execGit(args: string[], opts: ExecOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, {
      cwd: opts.cwd,
      env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
    })

    const stdout: Buffer[] = []
    const stderr: Buffer[] = []
    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk))
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk))

    child.on('error', reject)
    child.on('close', (code) => {
      const exitCode = code ?? -1
      if (exitCode === 0 || opts.allowExitCodes?.includes(exitCode)) {
        resolve(Buffer.concat(stdout).toString('utf8'))
      } else {
        reject(new GitError(args, exitCode, Buffer.concat(stderr).toString('utf8')))
      }
    })
  })
}
