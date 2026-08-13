import * as vscode from 'vscode'
import { GraphPanel } from './bridge/panel'
import { Router } from './bridge/router'
import { GitContentProvider, GITSCOPE_SCHEME } from './git/contentProvider'

export function activate(context: vscode.ExtensionContext): void {
  const router = new Router()

  context.subscriptions.push(
    vscode.commands.registerCommand('gitScope.view', () => {
      GraphPanel.show(context, router)
    }),
    vscode.workspace.registerTextDocumentContentProvider(
      GITSCOPE_SCHEME,
      new GitContentProvider((root) => router.getRepo(root)),
    ),
  )
}

export function deactivate(): void {}
