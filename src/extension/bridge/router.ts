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

type Handler<C extends RequestCommand> = (
  params: RequestMap[C]['params'],
) => Promise<RequestMap[C]['result']>

/** webview 요청을 GitRepo/VS Code API 호출로 라우팅한다 */
export class Router {
  private repos = new Map<string, GitRepo>()

  /** 절대 fsPath → webview URI 변환기 — GraphPanel이 webview 생성 시 주입 */
  uriMapper: ((fsPath: string) => string) | null = null
  /** 리포의 .git 변경 감지 콜백 — GraphPanel이 주입 (webview에 repoChanged 전달) */
  onRepoActivity: (() => void) | null = null

  private watchers = new Map<string, fs.FSWatcher>()

  constructor(
    readonly avatars: AvatarService,
    readonly icons: FileIconService,
  ) {}

  dispose(): void {
    for (const watcher of this.watchers.values()) watcher.close()
    this.watchers.clear()
  }

  /**
   * .git 디렉토리 감시 — 앱 내 액션이든 터미널 작업이든 HEAD/refs/index가 바뀌면
   * 디바운스 후 그래프를 자동 갱신하게 한다. (objects/logs 쓰기는 무시)
   */
  private watchRepo(root: string): void {
    if (this.watchers.has(root)) return
    try {
      let timer: ReturnType<typeof setTimeout> | undefined
      const watcher = fs.watch(
        path.join(root, '.git'),
        { recursive: true },
        (_event, filename) => {
          const name = filename?.toString() ?? ''
          if (name.startsWith('objects') || name.startsWith('logs')) return
          const relevant =
            name === '' ||
            name === 'HEAD' ||
            name === 'index' ||
            name === 'packed-refs' ||
            name.startsWith('refs') ||
            name.endsWith('_HEAD')
          if (!relevant) return
          clearTimeout(timer)
          timer = setTimeout(() => this.onRepoActivity?.(), 400)
        },
      )
      this.watchers.set(root, watcher)
    } catch {
      // 감시 실패는 치명적이지 않다 — 수동 새로고침으로 대체
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
    const handlers: { [K in RequestCommand]: Handler<K> } = {
      listRepos: () => this.listRepos(),
      getGraph: (p) => this.getRepo(p.repo).getGraph(p.maxCommits, p.branches),
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
      rebase: (p) => this.getRepo(p.repo).rebase(p.target),
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
      reset: (p) => this.getRepo(p.repo).reset(p.to, p.mode),
      fetch: (p) => this.getRepo(p.repo).fetch(p.prune),
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
      copyToClipboard: async (p) => {
        await vscode.env.clipboard.writeText(p.text)
        return { ok: true }
      },
    }
    return handlers[request.command](request.params)
  }
}
