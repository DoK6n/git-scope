import * as vscode from 'vscode'
import { GraphPanel } from './bridge/panel'
import { Router } from './bridge/router'
import { AvatarService } from './git/avatars'
import { GitContentProvider, GITSCOPE_SCHEME } from './git/contentProvider'

export function activate(context: vscode.ExtensionContext): void {
  const avatars = new AvatarService(context.globalStorageUri.fsPath, async () => {
    // Cursor/VS Code에 GitHub 로그인이 되어 있으면 그 세션 토큰을 쓴다 (silent — 로그인 팝업 없음)
    try {
      const session = await vscode.authentication.getSession('github', [], { silent: true })
      if (session) return session.accessToken
    } catch {
      // 인증 제공자 없음 — 환경변수로 폴백
    }
    return process.env.GITHUB_TOKEN ?? null
  })
  const router = new Router(avatars)

  context.subscriptions.push(
    vscode.commands.registerCommand('gitScope.view', () => {
      GraphPanel.show(context, router)
    }),
    vscode.commands.registerCommand('gitScope.clearAvatarCache', async () => {
      await avatars.clearCache()
      void vscode.window.showInformationMessage('GitScope: avatar cache cleared.')
    }),
    vscode.workspace.registerTextDocumentContentProvider(
      GITSCOPE_SCHEME,
      new GitContentProvider((root) => router.getRepo(root)),
    ),
  )
}

export function deactivate(): void {}
