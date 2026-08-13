import * as vscode from 'vscode'
import type { GitRepo } from './repo'

export const GITSCOPE_SCHEME = 'gitscope'

/**
 * 특정 커밋 시점의 파일 내용을 읽기 전용 문서로 제공한다.
 * URI 형태: gitscope:/<path>?<query: repo, hash, file>
 */
export class GitContentProvider implements vscode.TextDocumentContentProvider {
  constructor(private readonly getRepo: (root: string) => GitRepo | undefined) {}

  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    const params = new URLSearchParams(uri.query)
    const root = params.get('repo')
    const hash = params.get('hash')
    const file = params.get('file')
    if (!root || !hash || !file) return ''
    const repo = this.getRepo(root)
    if (!repo) return ''
    return repo.showFile(hash, file)
  }
}

export function makeGitUri(repo: string, hash: string, file: string): vscode.Uri {
  const query = new URLSearchParams({ repo, hash, file }).toString()
  // path는 디프 에디터 탭 제목 표시용
  return vscode.Uri.from({ scheme: GITSCOPE_SCHEME, path: `/${file}`, query })
}
