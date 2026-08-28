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

  private watchers = new Map<string, fs.FSWatcher[]>()
  private worktreeWatchers = new Map<string, vscode.FileSystemWatcher>()

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
      this.onRepoActivity?.()
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

    // Source Control의 Discard Changes처럼 index를 건드리지 않고 working tree 파일만
    // 바꾸는 작업도 감지한다. .git은 위의 전용 watcher가 처리하므로 여기서는 제외한다.
    // gitignore 대상(dist/ 빌드 산출물 등)의 쓰기는 그래프와 무관한데도 매번 갱신을
    // 일으켜 사실상 무한 리로드가 된다 — 배치로 모아 check-ignore로 걸러낸다.
    const worktreeWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(root, '**/*'),
    )
    const pendingPaths = new Set<string>()
    let ignoreTimer: ReturnType<typeof setTimeout> | undefined
    const onWorktreeActivity = (uri: vscode.Uri): void => {
      const relative = path.relative(root, uri.fsPath)
      if (
        relative === '' ||
        relative === '.git' ||
        relative.startsWith(`.git${path.sep}`) ||
        relative.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relative)
      )
        return
      pendingPaths.add(relative)
      clearTimeout(ignoreTimer)
      ignoreTimer = setTimeout(() => {
        const paths = [...pendingPaths]
        pendingPaths.clear()
        void this.allIgnored(root, paths).then((ignored) => {
          if (!ignored) fireActivity()
        })
      }, 400)
    }
    worktreeWatcher.onDidChange(onWorktreeActivity)
    worktreeWatcher.onDidCreate(onWorktreeActivity)
    worktreeWatcher.onDidDelete(onWorktreeActivity)
    this.worktreeWatchers.set(root, worktreeWatcher)
  }

  /**
   * 경로들이 전부 gitignore 대상인지 — 하나라도 무시 대상이 아니면 false.
   * 판정에 실패하면 갱신하는 쪽(false)이 안전하다.
   */
  private async allIgnored(root: string, paths: string[]): Promise<boolean> {
    if (paths.length === 0) return true
    try {
      const out = await execGit(['check-ignore', '--stdin', '-z'], {
        cwd: root,
        stdin: paths.map((p) => `${p}\0`).join(''),
        allowExitCodes: [1], // 1 = 무시 대상 없음
      })
      const ignoredCount = out.split('\0').filter((p) => p !== '').length
      return ignoredCount === paths.length
    } catch {
      return false
    }
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
      }
    }
  }

  private async dispatch<C extends RequestCommand>(
    request: BridgeRequest<C>,
  ): Promise<RequestMap[C]['result']> {
    const handlers: { [K in RequestCommand]: Handler<K> } = {
      listRepos: () => this.listRepos(),
      getGraph: (p) => this.getRepo(p.repo).getGraph(p.maxCommits, p.branches, p.includeRemotes),
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
