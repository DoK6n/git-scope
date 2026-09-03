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

    // .git·워킹트리 변경 감지 → webview에 갱신 신호 (액션·터미널 작업 모두 커버).
    // 패널이 안 보이는 동안에는 감시 처리를 통째로 건너뛰고(Router.isActive),
    // 다시 보이는 순간 한 번만 갱신한다 — 보이지도 않는 그래프 때문에 백그라운드에서
    // git이 계속 도는 것을 막는다.
    router.isActive = () => panel.visible
    router.onRepoActivity = () => this.post({ kind: 'event', event: 'repoChanged' })
    let wasVisible = panel.visible
    panel.onDidChangeViewState(
      () => {
        if (panel.visible === wasVisible) return
        wasVisible = panel.visible
        if (panel.visible) void router.refreshIfChanged()
      },
      undefined,
      this.disposables,
    )
    // 다른 창·터미널에서 작업하다 돌아온 경우 — 숨어 있는 동안 놓친 변경까지 반영
    vscode.window.onDidChangeWindowState(
      (state) => {
        if (state.focused && panel.visible) void router.refreshIfChanged()
      },
      undefined,
      this.disposables,
    )

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
      router.onRepoActivity = null
      router.isActive = null
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
