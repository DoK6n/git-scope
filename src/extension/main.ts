import * as vscode from 'vscode'
import { GraphPanel } from './bridge/panel'
import { Router } from './bridge/router'
import { AvatarService } from './git/avatars'
import { GitContentProvider, GITSCOPE_SCHEME } from './git/contentProvider'

export function activate(context: vscode.ExtensionContext): void {
  const avatars = new AvatarService(context.globalStorageUri.fsPath)
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
