import * as vscode from 'vscode'
import { stripCommitMessageComments } from './parse'

/**
 * VS Code 내장 git 익스텐션(`vscode.git`)의 공개 API 중 이 파일에서 쓰는 최소 부분.
 *
 * Microsoft는 이 타입을 npm에 배포하지 않는다(`@types/vscode`에도 없다). 전체 정의는
 * vscode 저장소 `extensions/git/src/api/git.d.ts`(MIT)에 있고, API 표면을 더 쓰게 되면
 * 그 파일을 저작권 헤더째로 가져오면 된다. 여기서는 소스 제어 입력칸 조작에 필요한
 * 만큼만 선언한다.
 */
interface BuiltinGitInputBox {
  value: string
}

interface BuiltinGitRepository {
  readonly rootUri: vscode.Uri
  readonly inputBox: BuiltinGitInputBox
}

interface BuiltinGitApi {
  readonly repositories: readonly BuiltinGitRepository[]
  getRepository(uri: vscode.Uri): BuiltinGitRepository | null
}

interface BuiltinGitExtension {
  readonly enabled: boolean
  /** 내장 git이 비활성(`git.enabled: false`)이면 throw 한다 */
  getAPI(version: 1): BuiltinGitApi
}

/**
 * 소스 제어 커밋 메시지 입력칸에 기본 메시지를 넣는다. 넣었으면 true.
 *
 * 내장 git은 `MERGE_MSG`를 읽어 입력칸을 채우는데, 그 경로를 `<root>/.git/MERGE_MSG`로
 * 조립하기 때문에 worktree·서브모듈에서는 읽지 못한다. 그 저장소에서는 GitScope가
 * 값을 직접 넣어 터미널에서 커밋할 때와 같은 기본 메시지가 뜨게 한다.
 *
 * 입력칸에 이미 사용자가 쓴 내용이 있으면 덮어쓰지 않는다. 실패는 전부 조용히 흘린다 —
 * 커밋 메시지 기본값은 부가 기능이므로 이것 때문에 머지 결과가 달라지면 안 된다.
 */
export async function seedScmCommitMessage(root: string, message: string): Promise<boolean> {
  const repository = await getBuiltinGitRepository(root)
  if (!repository) return false

  // 주석이 아닌 줄이 이미 있으면 사용자나 내장 git이 채운 메시지다 — 건드리지 않는다
  if (stripCommitMessageComments(repository.inputBox.value) !== '') return false

  repository.inputBox.value = message
  return true
}

async function getBuiltinGitRepository(root: string): Promise<BuiltinGitRepository | null> {
  const extension = vscode.extensions.getExtension<BuiltinGitExtension>('vscode.git')
  if (!extension) return null

  try {
    // activationEvents가 "*"라 대개 이미 켜져 있지만, exports가 undefined인 타이밍이 있다
    const gitExtension = extension.isActive ? extension.exports : await extension.activate()
    if (!gitExtension?.enabled) return null

    const api = gitExtension.getAPI(1)
    return (
      api.getRepository(vscode.Uri.file(root)) ??
      api.repositories.find((repository) => repository.rootUri.fsPath === root) ??
      null
    )
  } catch {
    // 내장 git 비활성·API 버전 불일치 등 — 기본 메시지 없이 진행한다
    return null
  }
}
