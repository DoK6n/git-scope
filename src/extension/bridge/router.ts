import * as fs from 'node:fs'
import * as path from 'node:path'
import * as vscode from 'vscode'
import type { ActionResult, RepoInfo } from '@shared-types/domain'
import type { BridgeRequest, RequestCommand, RequestMap } from '@shared-types/messages'
import { AvatarService } from '../git/avatars'
import { EMPTY_TREE_HASH, GitRepo } from '../git/repo'
import { execGit } from '../git/exec'
import { makeGitUri } from '../git/contentProvider'
import type { FileIconService } from '../icons/fileIcons'
import type { IconSpec } from '@shared-types/domain'
import { sendActionEvent } from '../telemetry'

type Handler<C extends RequestCommand> = (
  params: RequestMap[C]['params'],
) => Promise<RequestMap[C]['result']>

const READ_ONLY_REQUESTS = new Set<RequestCommand>([
  'listRepos',
  'getGraph',
  'getCommitDetails',
  'getCommitComparison',
  'openDiff',
  'getTagDetails',
  'openScmView',
  'listStashes',
  'listWorktrees',
  'openWorktree',
  'getFileIcons',
  'getAvatar',
  'notify',
  'copyToClipboard',
  'openFile',
])

/** webview 요청을 GitRepo/VS Code API 호출로 라우팅한다 */
export class Router {
  private repos = new Map<string, GitRepo>()

  /** 절대 fsPath → webview URI 변환기 — GraphPanel이 webview 생성 시 주입 */
  uriMapper: ((fsPath: string) => string) | null = null
  /** 리포의 .git 변경 감지 콜백 — GraphPanel이 주입 (webview에 repoChanged 전달) */
  onRepoActivity: (() => void) | null = null

  /** 그래프가 화면에 보이는지 — GraphPanel이 주입. 안 보이면 감시 처리를 통째로 건너뛴다 */
  isActive: (() => boolean) | null = null

  private watchers = new Map<string, fs.FSWatcher[]>()
  private worktreeWatchers = new Map<string, vscode.FileSystemWatcher>()
  /** 리포별 gitdir·commondir — 변경 여부를 mtime으로 싸게 판정할 때 쓴다 */
  private gitDirs = new Map<string, string[]>()
  /** 마지막으로 그래프를 그린 리포 — 포커스 복귀 시 이 리포만 확인한다 */
  private activeRepo: string | null = null
  /** 리포별 마지막 상태 서명(refs·HEAD·index) */
  private lastSignature = new Map<string, string>()
  /** 액션 직후 상태 기록이 진행 중인 리포 — 감시 이벤트가 이걸 기다린다 */
  private stateRecording = new Map<string, Promise<void>>()
  /** 리포별 `디렉토리 → gitignore 대상인가` 캐시 — 채워지면 무시 대상 이벤트를 git 없이 버린다 */
  private ignoredDirs = new Map<string, Map<string, boolean>>()
  /** 리포별 마지막 `git status` 출력 — 실제로 달라졌을 때만 갱신하기 위한 서명 */
  private lastStatus = new Map<string, string>()

  /** 처리 중인 변경 요청 수 / 마지막 변경 완료 시각 — 자기 유발 감시 이벤트 억제용 */
  private runningMutations = 0
  private lastMutationDone = 0

  constructor(
    readonly avatars: AvatarService,
    readonly icons: FileIconService,
  ) {}

  dispose(): void {
    for (const list of this.watchers.values()) for (const watcher of list) watcher.close()
    this.watchers.clear()
    for (const watcher of this.worktreeWatchers.values()) watcher.dispose()
    this.worktreeWatchers.clear()
    this.lastStatus.clear()
    this.lastSignature.clear()
    this.ignoredDirs.clear()
    this.gitDirs.clear()
  }

  /**
   * .git 감시 — 앱 내 액션이든 터미널·IDE 작업이든 HEAD/refs/index가 바뀌면
   * 디바운스 후 그래프를 자동 갱신하게 한다. (objects/logs 쓰기는 무시)
   */
  private watchRepo(root: string): void {
    if (this.watchers.has(root)) return
    this.watchers.set(root, [])
    void this.startWatchers(root)
  }

  private async startWatchers(root: string): Promise<void> {
    // worktree·서브모듈은 root/.git이 디렉토리가 아니라 gitdir 경로가 적힌 파일이라
    // 그대로 감시하면 아무 이벤트도 오지 않는다. 실제 gitdir(HEAD/index)과
    // commondir(refs/packed-refs)을 해석해 둘 다 감시한다.
    const dirs = new Set<string>()
    try {
      const out = await execGit(['rev-parse', '--absolute-git-dir', '--git-common-dir'], {
        cwd: root,
      })
      const [gitDir, commonDir] = out.trim().split('\n')
      if (gitDir) dirs.add(gitDir)
      if (commonDir) dirs.add(path.resolve(root, commonDir))
    } catch {
      dirs.add(path.join(root, '.git'))
    }
    this.gitDirs.set(root, [...dirs])
    const list = this.watchers.get(root)
    if (!list) return
    // 갱신은 최소 2초 간격 — 코드젠·캐시처럼 파일을 연달아 쓰는 도구가 있어도
    // 초 단위로 전체 재조회가 도는 사태를 막는다 (마지막 이벤트는 trailing으로 반영)
    let lastFired = 0
    let trailing: ReturnType<typeof setTimeout> | undefined
    const fireActivity = (): void => {
      if (this.runningMutations > 0 || Date.now() - this.lastMutationDone < 800) return
      const wait = 2000 - (Date.now() - lastFired)
      if (wait > 0) {
        clearTimeout(trailing)
        trailing = setTimeout(fireActivity, wait)
        return
      }
      lastFired = Date.now()
      void this.notifyIfChanged(root)
    }
    let timer: ReturnType<typeof setTimeout> | undefined
    const scheduleActivity = (): void => {
      clearTimeout(timer)
      timer = setTimeout(fireActivity, 400)
    }
    for (const dir of dirs) {
      try {
        const watcher = fs.watch(dir, { recursive: true }, (_event, filename) => {
          const name = filename?.toString() ?? ''
          if (name.startsWith('objects') || name.startsWith('logs') || name.includes('/logs/'))
            return
          const relevant =
            name === '' ||
            name === 'HEAD' ||
            name === 'index' ||
            name === 'packed-refs' ||
            name.startsWith('refs') ||
            name.endsWith('_HEAD') ||
            name.endsWith('/HEAD') // 다른 worktree의 HEAD 이동 (commondir/worktrees/*/HEAD)
          if (!relevant) return
          // 앱 자신의 변경 요청이 낸 이벤트로 다시 갱신하면 클릭 한 번에 그래프가
          // 여러 번 리로드된다. 액션 후 갱신은 runAction이 이미 처리한다.
          scheduleActivity()
        })
        list.push(watcher)
      } catch {
        // 감시 실패는 치명적이지 않다 — 수동 새로고침으로 대체
      }
    }

    // 워킹트리도 감시한다 — IDE Source Control의 Discard Changes나 터미널 작업처럼
    // .git을 건드리지 않는 변경도 uncommitted 행에 반영해야 하기 때문이다.
    // 다만 이벤트 1건의 단가를 0에 가깝게 유지하는 게 핵심이다: 예전에는 배치마다
    // `git check-ignore`를 띄우고 전체 그래프를 재조회해서, 파일이 많은 저장소에서
    // 실제 변경이 없는데도 2초마다 git 7~8개가 영구히 도는 상태가 됐다.
    // 이제 두 개의 게이트를 거친다 — (1) mtime으로 "정말 바뀐 파일인지" 로컬 판정(git 0개),
    // (2) 통과한 경우에만 status 서명을 비교해 실제로 달라졌을 때만 webview에 알린다.
    const worktreeWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(root, '**/*'),
    )
    const pending = new Map<string, 'touched' | 'deleted'>()
    let batchTimer: ReturnType<typeof setTimeout> | undefined
    const onWorktreeEvent = (uri: vscode.Uri, kind: 'touched' | 'deleted'): void => {
      if (this.isActive?.() === false) return
      const relative = path.relative(root, uri.fsPath)
      if (
        relative === '' ||
        relative === '.git' ||
        relative.startsWith(`.git${path.sep}`) ||
        relative.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relative)
      )
        return
      pending.set(relative, kind)
      clearTimeout(batchTimer)
      batchTimer = setTimeout(() => {
        const batch = [...pending]
        pending.clear()
        void this.onWorktreeBatch(root, batch, fireActivity)
      }, 400)
    }
    worktreeWatcher.onDidChange((uri) => onWorktreeEvent(uri, 'touched'))
    worktreeWatcher.onDidCreate((uri) => onWorktreeEvent(uri, 'touched'))
    worktreeWatcher.onDidDelete((uri) => onWorktreeEvent(uri, 'deleted'))
    this.worktreeWatchers.set(root, worktreeWatcher)
  }

  /** 창·패널이 다시 활성화됐을 때의 확인 — 마지막으로 그래프를 그린 리포만 본다 */
  async refreshIfChanged(): Promise<void> {
    if (this.activeRepo === null) return
    await this.notifyIfChanged(this.activeRepo)
  }

  /**
   * 모든 감시 경로가 통과하는 단일 게이트 — 리포 상태가 **직전에 알던 것과 다를 때만** 갱신을 알린다.
   * 앱 자신의 액션이 낸 감시 이벤트는 recordState가 남긴 서명과 같으므로 여기서 걸러진다.
   * (예전에는 액션 완료 후 800ms 뮤트에만 의존해서, stash처럼 .git과 워킹트리를 함께
   *  바꾸는 액션은 2초 뒤 워처 이벤트로 그래프가 한 번 더 그려졌다.)
   */
  private async notifyIfChanged(root: string): Promise<void> {
    if (this.isActive?.() === false) return
    if (this.runningMutations > 0) return
    await this.stateRecording.get(root)
    let changed = false
    const state = await this.readState(root)
    for (const [store, value] of [
      [this.lastSignature, state.signature],
      [this.lastStatus, state.status],
    ] as const) {
      const previous = store.get(root)
      if (previous !== undefined && previous !== value) changed = true
      store.set(root, value)
    }
    if (changed) this.onRepoActivity?.()
  }

  /** 액션 직후의 상태를 서명으로 남긴다 — 그 액션이 유발한 감시 이벤트의 중복 갱신을 막는다 */
  private recordState(root: string): void {
    const recording = this.readState(root).then((state) => {
      this.lastSignature.set(root, state.signature)
      this.lastStatus.set(root, state.status)
    })
    this.stateRecording.set(root, recording)
    void recording.finally(() => {
      if (this.stateRecording.get(root) === recording) this.stateRecording.delete(root)
    })
  }

  /**
   * 리포 상태 읽기 — refs 전체(git 1회), HEAD 내용과 index mtime(파일시스템), 워킹트리 status(git 1회).
   * refs를 mtime으로 판정하면 `refs/heads/feat/x`처럼 중첩된 ref 갱신이 상위 디렉토리
   * mtime에 드러나지 않아 fetch·커밋을 놓친다 — 그래서 refs만은 git에 직접 묻는다.
   */
  private async readState(root: string): Promise<{ signature: string; status: string }> {
    const parts: string[] = []
    for (const dir of this.gitDirs.get(root) ?? [path.join(root, '.git')]) {
      try {
        const head = await fs.promises.readFile(path.join(dir, 'HEAD'), 'utf8')
        parts.push(`HEAD:${head.trim()}`)
      } catch {
        parts.push('HEAD:-')
      }
      try {
        const stat = await fs.promises.stat(path.join(dir, 'index'))
        parts.push(`index:${stat.mtimeMs}`)
      } catch {
        parts.push('index:-')
      }
    }
    const [refs, status] = await Promise.all([
      execGit(['for-each-ref', '--format=%(objectname) %(refname)'], { cwd: root }).catch(
        () => 'refs:-',
      ),
      execGit(['status', '--porcelain', '-z'], { cwd: root }).catch(() => 'status:-'),
    ])
    parts.push(refs)
    return { signature: parts.join('|'), status }
  }

  /**
   * 배치에서 gitignore 대상 경로를 걸러낸다 — 빌드 산출물·캐시(`.next`, `dist`, turbopack 등)를
   * 계속 쓰는 도구가 돌아도 감시 비용이 붙지 않게 한다.
   *
   * 판정은 **디렉토리 단위로 캐시**한다: git에서 디렉토리가 제외 대상이면 그 안의 모든 경로도
   * 제외 대상이므로, `.next/dev/cache/turbopack`을 한 번 판정해두면 그 아래에서 쏟아지는
   * 이벤트는 git 프로세스 없이 버려진다. 캐시가 채워진 뒤에는 호출당 git 0개.
   */
  private async withoutIgnored(
    root: string,
    batch: [string, 'touched' | 'deleted'][],
  ): Promise<[string, 'touched' | 'deleted'][]> {
    let cache = this.ignoredDirs.get(root)
    if (!cache) {
      cache = new Map()
      this.ignoredDirs.set(root, cache)
    }
    // .gitignore가 바뀌면 판정이 뒤집힐 수 있다 — 캐시를 버리고 다시 묻는다
    if (batch.some(([relative]) => path.basename(relative) === '.gitignore')) cache.clear()
    // 거대한 트리에서 무한히 자라지 않게 상한을 둔다
    if (cache.size > 4000) cache.clear()

    const dirOf = (relative: string): string => {
      const dir = path.dirname(relative)
      return dir === '.' ? '' : dir
    }
    const unknown = [
      ...new Set(batch.map(([relative]) => dirOf(relative)).filter((d) => d !== '' && !cache.has(d))),
    ]
    if (unknown.length > 0) {
      try {
        const out = await execGit(['check-ignore', '--stdin', '-z'], {
          cwd: root,
          stdin: unknown.map((d) => `${d}\0`).join(''),
          allowExitCodes: [1], // 1 = 무시 대상 없음
        })
        const ignored = new Set(out.split('\0').filter((p) => p !== ''))
        for (const dir of unknown) cache.set(dir, ignored.has(dir))
      } catch {
        // 판정 실패는 캐시하지 않는다 — 이번 배치는 통과시키고 다음에 다시 묻는다
      }
    }
    return batch.filter(([relative]) => cache.get(dirOf(relative)) !== true)
  }

  /** 워처가 준 경로 중 하나라도 최근에 실제로 바뀌었는지 — git 프로세스 없이 mtime만 본다 */
  private async batchHasRealChange(
    root: string,
    batch: [string, 'touched' | 'deleted'][],
  ): Promise<boolean> {
    const now = Date.now()
    // 한 번에 쏟아지는 경로가 많아도 판정 비용을 상수로 묶는다
    for (const [relative, kind] of batch.slice(0, 200)) {
      if (kind === 'deleted') return true
      try {
        const stat = await fs.promises.stat(path.join(root, relative))
        if (stat.isDirectory()) continue
        if (now - stat.mtimeMs < 10_000) return true
      } catch {
        return true // 이벤트 사이에 사라진 파일 — 실제 변경으로 본다
      }
    }
    return false
  }

  /**
   * 워킹트리 변경 배치 처리 — 실제 변경이 있고 status 출력까지 달라졌을 때만 갱신을 알린다.
   * 이미 수정된 파일을 계속 저장하는 경우처럼 status가 그대로면 그래프는 건드리지 않는다.
   */
  private async onWorktreeBatch(
    root: string,
    batch: [string, 'touched' | 'deleted'][],
    fireActivity: () => void,
  ): Promise<void> {
    if (this.isActive?.() === false) return
    if (this.runningMutations > 0 || Date.now() - this.lastMutationDone < 800) return
    const relevant = await this.withoutIgnored(root, batch)
    if (relevant.length === 0) return
    if (!(await this.batchHasRealChange(root, relevant))) return
    fireActivity()
  }

  private mapIconUri(spec: IconSpec | null): IconSpec | null {
    if (!spec) return null
    if (spec.svg && this.uriMapper) return { ...spec, svg: this.uriMapper(spec.svg) }
    return spec
  }

  getRepo(root: string): GitRepo {
    let repo = this.repos.get(root)
    if (!repo) {
      repo = new GitRepo(root)
      this.repos.set(root, repo)
      this.watchRepo(root)
    }
    return repo
  }

  /** 워크스페이스 폴더 중 git 리포인 것들을 찾는다 */
  private async listRepos(): Promise<RepoInfo[]> {
    const folders = vscode.workspace.workspaceFolders ?? []
    const repos: RepoInfo[] = []
    for (const folder of folders) {
      try {
        const root = (
          await execGit(['rev-parse', '--show-toplevel'], { cwd: folder.uri.fsPath })
        ).trim()
        if (root && !repos.some((r) => r.root === root)) {
          repos.push({ root, name: path.basename(root) })
        }
      } catch {
        // git 리포가 아닌 폴더는 무시
      }
    }
    return repos
  }

  private async openDiff(params: RequestMap['openDiff']['params']): Promise<ActionResult> {
    try {
      const { repo, hash, baseHash, path: filePath, oldPath } = params
      const details = baseHash === null ? await this.getRepo(repo).getCommitDetails(hash) : null
      const base =
        baseHash ?? (details && details.parents.length > 0 ? details.parents[0]! : EMPTY_TREE_HASH)
      const left = makeGitUri(repo, base, oldPath ?? filePath)
      const right = makeGitUri(repo, hash, filePath)
      const title = `${path.basename(filePath)} (${base.slice(0, 8)} ↔ ${hash.slice(0, 8)})`
      await vscode.commands.executeCommand('vscode.diff', left, right, title, { preview: true })
      return { ok: true }
    } catch (e) {
      return { ok: false, error: String(e) }
    }
  }

  async handle<C extends RequestCommand>(
    request: BridgeRequest<C>,
  ): Promise<RequestMap[C]['result']> {
    const mutatesRepo = !READ_ONLY_REQUESTS.has(request.command)
    if (mutatesRepo) this.runningMutations++
    const started = Date.now()
    try {
      const result = await this.dispatch(request)
      if (mutatesRepo) {
        // 이벤트에는 명령 이름과 성공 여부만 담는다 — 파라미터·에러 문자열은
        // 브랜치명·경로 등 리포 내용을 포함할 수 있어 전송하지 않는다
        const ok =
          typeof result === 'object' && result !== null && 'ok' in result
            ? (result as { ok: boolean }).ok
            : true
        sendActionEvent(request.command, ok, Date.now() - started)
      }
      return result
    } catch (e) {
      if (mutatesRepo) sendActionEvent(request.command, false, Date.now() - started)
      throw e
    } finally {
      if (mutatesRepo) {
        this.runningMutations--
        this.lastMutationDone = Date.now()
        const params = request.params as { repo?: unknown }
        if (typeof params.repo === 'string') this.recordState(params.repo)
      }
    }
  }

  private async dispatch<C extends RequestCommand>(
    request: BridgeRequest<C>,
  ): Promise<RequestMap[C]['result']> {
    const handlers: { [K in RequestCommand]: Handler<K> } = {
      listRepos: () => this.listRepos(),
      getGraph: (p) => {
        this.activeRepo = p.repo
        return this.getRepo(p.repo).getGraph(p.maxCommits, p.branches, p.includeRemotes)
      },
      getCommitDetails: (p) => this.getRepo(p.repo).getCommitDetails(p.hash),
      getCommitComparison: (p) => this.getRepo(p.repo).getComparison(p.fromHash, p.toHash),
      openDiff: (p) => this.openDiff(p),
      checkoutBranch: (p) => this.getRepo(p.repo).checkoutBranch(p.name),
      checkoutRemoteBranch: (p) =>
        this.getRepo(p.repo).checkoutRemoteBranch(p.remoteName, p.localName),
      checkoutCommit: (p) => this.getRepo(p.repo).checkoutCommit(p.hash),
      createBranch: (p) => this.getRepo(p.repo).createBranch(p.name, p.at, p.checkout),
      deleteBranch: (p) => this.getRepo(p.repo).deleteBranch(p.name, p.force),
      renameBranch: (p) => this.getRepo(p.repo).renameBranch(p.oldName, p.newName),
      merge: (p) => this.getRepo(p.repo).merge(p.target, p.noFf, p.squash),
      createTag: (p) => this.getRepo(p.repo).createTag(p.name, p.at, p.message),
      deleteTag: (p) => this.getRepo(p.repo).deleteTag(p.name),
      cherryPick: (p) =>
        this.getRepo(p.repo).cherryPick(p.hash, p.noCommit, p.recordOrigin, p.isMerge),
      revert: (p) => this.getRepo(p.repo).revert(p.hash, p.isMerge),
      dropCommit: (p) => this.getRepo(p.repo).dropCommit(p.hash),
      rewordCommit: (p) => this.getRepo(p.repo).rewordCommit(p.hash, p.message),
      commitFixup: (p) => this.getRepo(p.repo).commitFixup(p.hash, p.includeAll),
      autosquash: (p) => this.getRepo(p.repo).autosquash(p.baseHash),
      rebase: (p) => this.getRepo(p.repo).rebase(p.target),
      mergeBranchInto: (p) => this.getRepo(p.repo).mergeBranchInto(p.source, p.target),
      rebaseBranchOnto: (p) => this.getRepo(p.repo).rebaseBranchOnto(p.branch, p.onto),
      pushBranch: (p) =>
        this.getRepo(p.repo).pushBranch(p.name, p.remote, p.setUpstream, p.force),
      pullBranch: (p) => this.getRepo(p.repo).pullBranch(p.remote, p.branch),
      deleteRemoteBranch: (p) => this.getRepo(p.repo).deleteRemoteBranch(p.remote, p.name),
      fetchIntoLocal: (p) =>
        this.getRepo(p.repo).fetchIntoLocal(p.remote, p.remoteBranch, p.localBranch),
      pushTag: (p) => this.getRepo(p.repo).pushTag(p.name, p.remote),
      getTagDetails: (p) => this.getRepo(p.repo).getTagDetails(p.name),
      stashApply: (p) => this.getRepo(p.repo).stashApply(p.selector, p.reinstateIndex),
      stashPop: (p) => this.getRepo(p.repo).stashPop(p.selector, p.reinstateIndex),
      stashDrop: (p) => this.getRepo(p.repo).stashDrop(p.selector),
      stashBranch: (p) => this.getRepo(p.repo).stashBranch(p.selector, p.branchName),
      stashPush: (p) => this.getRepo(p.repo).stashPush(p.message, p.includeUntracked),
      cleanUntracked: (p) => this.getRepo(p.repo).cleanUntracked(p.directories),
      discardAllChanges: (p) => this.getRepo(p.repo).discardAllChanges(),
      openScmView: async () => {
        await vscode.commands.executeCommand('workbench.view.scm')
        return { ok: true }
      },
      openFile: async (p) => {
        try {
          await vscode.commands.executeCommand(
            'vscode.open',
            vscode.Uri.file(path.join(p.repo, p.path)),
            { preview: true },
          )
          return { ok: true }
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : String(e) }
        }
      },
      reset: (p) => this.getRepo(p.repo).reset(p.to, p.mode),
      fetch: (p) => this.getRepo(p.repo).fetch(p.prune),
      listStashes: (p) => this.getRepo(p.repo).listStashes(),
      listWorktrees: (p) => this.getRepo(p.repo).listWorktrees(),
      addWorktree: (p) =>
        this.getRepo(p.repo).addWorktree(p.path, p.branch, p.createBranch, p.startPoint),
      removeWorktree: (p) => this.getRepo(p.repo).removeWorktree(p.path, p.force),
      moveWorktree: (p) => this.getRepo(p.repo).moveWorktree(p.path, p.newPath),
      repairWorktree: (p) => this.getRepo(p.repo).repairWorktree(p.path),
      lockWorktree: (p) => this.getRepo(p.repo).lockWorktree(p.path, p.lock),
      openWorktree: async (p) => {
        await vscode.commands.executeCommand(
          'vscode.openFolder',
          vscode.Uri.file(p.path),
          { forceNewWindow: p.newWindow },
        )
        return { ok: true }
      },
      getFileIcons: async (p) => {
        const files: Record<string, IconSpec | null> = {}
        const foldersCollapsed: Record<string, IconSpec | null> = {}
        const foldersExpanded: Record<string, IconSpec | null> = {}
        for (const name of p.files) files[name] = this.mapIconUri(this.icons.fileIcon(name))
        for (const name of p.folders) {
          foldersCollapsed[name] = this.mapIconUri(this.icons.folderIcon(name, false))
          foldersExpanded[name] = this.mapIconUri(this.icons.folderIcon(name, true))
        }
        const fonts = this.icons
          .fonts()
          .map((f) => ({ ...f, src: this.uriMapper ? this.uriMapper(f.src) : f.src }))
        return { files, foldersCollapsed, foldersExpanded, fonts }
      },
      getAvatar: async (p) => ({
        dataUri: await this.avatars.getAvatar(p.repo, p.email, p.commitHash),
      }),
      notify: async (p) => {
        if (p.level === 'error') void vscode.window.showErrorMessage(`Git Scope: ${p.message}`)
        else void vscode.window.showInformationMessage(`Git Scope: ${p.message}`)
        return { ok: true }
      },
      copyToClipboard: async (p) => {
        await vscode.env.clipboard.writeText(p.text)
        return { ok: true }
      },
    }
    return handlers[request.command](request.params)
  }
}
