import * as vscode from 'vscode'
import { GraphPanel } from './bridge/panel'
import { Router } from './bridge/router'
import { AvatarService } from './git/avatars'
import { GitContentProvider, GITSCOPE_SCHEME } from './git/contentProvider'

const GITHUB_SCOPES = ['repo']
const TOKEN_SECRET_KEY = 'gitScope.githubToken'

export function activate(context: vscode.ExtensionContext): void {
  const avatars = new AvatarService(context.globalStorageUri.fsPath, async () => {
    // 우선순위: GitHub 로그인 세션 → SecretStorage에 저장한 PAT → 환경변수
    try {
      const session = await vscode.authentication.getSession('github', GITHUB_SCOPES, {
        silent: true,
      })
      if (session) return session.accessToken
    } catch {
      // 인증 제공자 없음 — 아래 폴백으로
    }
    const stored = await context.secrets.get(TOKEN_SECRET_KEY)
    if (stored) return stored
    return process.env.GITHUB_TOKEN ?? null
  })
  const router = new Router(avatars)

  context.subscriptions.push(
    vscode.commands.registerCommand('gitScope.view', () => {
      GraphPanel.show(context, router)
    }),
    vscode.commands.registerCommand('gitScope.clearAvatarCache', async () => {
      await avatars.clearCache()
      void vscode.window.showInformationMessage('Git Scope: avatar cache cleared.')
    }),
    vscode.commands.registerCommand('gitScope.signInGitHub', async () => {
      try {
        const session = await vscode.authentication.getSession('github', GITHUB_SCOPES, {
          createIfNone: true,
        })
        // 미인증 시절의 "아바타 없음" 네거티브 캐시를 비워 재조회하게 한다
        await avatars.clearCache()
        void vscode.window.showInformationMessage(
          `Git Scope: signed in as ${session.account.label}. Avatars will reload.`,
        )
      } catch (e) {
        void vscode.window.showErrorMessage(
          `Git Scope: GitHub sign-in failed — ${e instanceof Error ? e.message : String(e)}`,
        )
      }
    }),
    vscode.commands.registerCommand('gitScope.setGitHubToken', async () => {
      const token = await vscode.window.showInputBox({
        title: 'Git Scope: GitHub Personal Access Token',
        prompt: '비공개 리포 아바타 조회용 PAT (classic: repo 스코프 / fine-grained: Contents read). 비워두면 저장된 토큰을 삭제합니다.',
        password: true,
        ignoreFocusOut: true,
      })
      if (token === undefined) return // 취소
      if (token.trim() === '') {
        await context.secrets.delete(TOKEN_SECRET_KEY)
        void vscode.window.showInformationMessage('Git Scope: stored GitHub token removed.')
      } else {
        await context.secrets.store(TOKEN_SECRET_KEY, token.trim())
        await avatars.clearCache()
        void vscode.window.showInformationMessage(
          'Git Scope: GitHub token saved (SecretStorage). Avatars will reload.',
        )
      }
    }),
    vscode.workspace.registerTextDocumentContentProvider(
      GITSCOPE_SCHEME,
      new GitContentProvider((root) => router.getRepo(root)),
    ),
  )
}

export function deactivate(): void {}
