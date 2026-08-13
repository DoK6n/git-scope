import * as path from 'node:path'
import * as vscode from 'vscode'
import type { ActionResult, RepoInfo } from '@shared-types/domain'
import type { BridgeRequest, RequestCommand, RequestMap } from '@shared-types/messages'
import { EMPTY_TREE_HASH, GitRepo } from '../git/repo'
import { execGit } from '../git/exec'
import { makeGitUri } from '../git/contentProvider'

type Handler<C extends RequestCommand> = (
  params: RequestMap[C]['params'],
) => Promise<RequestMap[C]['result']>

/** webview 요청을 GitRepo/VS Code API 호출로 라우팅한다 */
export class Router {
  private repos = new Map<string, GitRepo>()

  getRepo(root: string): GitRepo {
    let repo = this.repos.get(root)
    if (!repo) {
      repo = new GitRepo(root)
      this.repos.set(root, repo)
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
      reset: (p) => this.getRepo(p.repo).reset(p.to, p.mode),
      fetch: (p) => this.getRepo(p.repo).fetch(p.prune),
      listWorktrees: (p) => this.getRepo(p.repo).listWorktrees(),
      addWorktree: (p) =>
        this.getRepo(p.repo).addWorktree(p.path, p.branch, p.createBranch, p.startPoint),
      removeWorktree: (p) => this.getRepo(p.repo).removeWorktree(p.path, p.force),
      openWorktree: async (p) => {
        await vscode.commands.executeCommand(
          'vscode.openFolder',
          vscode.Uri.file(p.path),
          { forceNewWindow: true },
        )
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
