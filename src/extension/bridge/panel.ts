import * as vscode from 'vscode'
import type { BridgeRequest, HostMessage } from '@shared-types/messages'
import { readSettings } from '../config/settings'
import { Router } from './router'

/** GitScope 그래프 webview 패널 (창당 싱글턴) */
export class GraphPanel {
  private static current: GraphPanel | undefined

  static show(context: vscode.ExtensionContext, router: Router): void {
    if (GraphPanel.current) {
      GraphPanel.current.panel.reveal()
      return
    }
    // 아이콘 테마 익스텐션의 리소스(svg/폰트)를 webview가 로드할 수 있도록 루트에 포함
    const iconThemeDir = router.icons.themeDir()
    const panel = vscode.window.createWebviewPanel(
      'gitScope.graph',
      'Git Scope',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview'),
          ...(iconThemeDir ? [vscode.Uri.file(iconThemeDir)] : []),
        ],
      },
    )
    panel.iconPath = vscode.Uri.joinPath(context.extensionUri, 'resources', 'tab-icon.svg')
    router.uriMapper = (fsPath) => panel.webview.asWebviewUri(vscode.Uri.file(fsPath)).toString()
    GraphPanel.current = new GraphPanel(panel, context, router)
  }

  private disposables: vscode.Disposable[] = []

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    context: vscode.ExtensionContext,
    router: Router,
  ) {
    panel.webview.html = this.buildHtml(context)

    panel.webview.onDidReceiveMessage(
      async (message: BridgeRequest) => {
        if (message?.kind !== 'request') return
        try {
          const result = await router.handle(message)
          this.post({ kind: 'response', id: message.id, ok: true, result })
        } catch (e) {
          this.post({
            kind: 'response',
            id: message.id,
            ok: false,
            error: e instanceof Error ? e.message : String(e),
          })
        }
      },
      undefined,
      this.disposables,
    )

    vscode.workspace.onDidChangeConfiguration(
      (e) => {
        if (e.affectsConfiguration('gitScope')) {
          this.post({ kind: 'event', event: 'settings', settings: readSettings() })
        }
      },
      undefined,
      this.disposables,
    )

    panel.onDidDispose(() => {
      GraphPanel.current = undefined
      for (const d of this.disposables) d.dispose()
    })
  }

  private post(message: HostMessage): void {
    void this.panel.webview.postMessage(message)
  }

  private buildHtml(context: vscode.ExtensionContext): string {
    const webview = this.panel.webview
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview', 'main.js'),
    )
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview', 'main.css'),
    )
    const nonce = Array.from({ length: 32 }, () =>
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.charAt(
        Math.floor(Math.random() * 62),
      ),
    ).join('')
    const initialSettings = JSON.stringify(readSettings())

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}'; font-src ${webview.cspSource}; img-src https: data:;">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${styleUri}">
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}">window.__GITSCOPE_SETTINGS__ = ${initialSettings};</script>
  <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
</body>
</html>`
  }
}
