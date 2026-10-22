import * as path from 'node:path'
import * as vscode from 'vscode'
import { blameFile, headStamp, resolveBlameRepo } from '../git/blame'
import type { BlameCommit, BlameLines, BlameRepo } from '../git/blame'
import { inlineBlameText, relativeTime } from './blameText'
import type { BlameLanguage } from './blameText'

export const SHOW_COMMIT_COMMAND = 'gitScope.blame.showCommitInGraph'

/** 이보다 긴 파일은 blame을 건너뛴다 — git blame 비용이 줄 수와 히스토리에 비례한다 */
const MAX_LINES = 20000
/** 커서 이동 후 표시까지 기다리는 시간 */
const SELECTION_DELAY = 100
/** 편집 후 다시 blame할 때까지 기다리는 시간 */
const EDIT_DELAY = 500

interface CacheEntry {
  version: number
  stamp: number
  lines: Promise<BlameLines | null>
}

interface ShowCommitArgs {
  root: string
  hash: string
}

/**
 * 에디터 커서 줄 끝에 그 줄을 마지막으로 바꾼 커밋을 표시한다.
 * 줄 끝 표시에 마우스를 올리면 상세와 '그래프에서 보기' 링크가 뜬다.
 */
export class BlameController implements vscode.Disposable {
  private readonly decoration = vscode.window.createTextEditorDecorationType({
    after: {
      color: new vscode.ThemeColor('editorCodeLens.foreground'),
      fontStyle: 'italic',
      margin: '0 0 0 3em',
    },
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen,
  })
  private readonly disposables: vscode.Disposable[] = []
  private readonly cache = new Map<string, CacheEntry>()
  private readonly repos = new Map<string, Promise<BlameRepo | null>>()
  private timer: ReturnType<typeof setTimeout> | undefined
  /** 지금 표시 중인 줄 — hover가 같은 줄일 때만 상세를 보여준다 */
  private shown: { uri: string; line: number; commit: BlameCommit; repo: BlameRepo } | null = null

  constructor(private readonly reveal: (root: string, hash: string) => void) {
    this.disposables.push(
      this.decoration,
      vscode.window.onDidChangeTextEditorSelection((e) => {
        if (e.textEditor === vscode.window.activeTextEditor) this.schedule(SELECTION_DELAY)
      }),
      vscode.window.onDidChangeActiveTextEditor(() => this.schedule(0)),
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.document !== vscode.window.activeTextEditor?.document) return
        if (e.contentChanges.length === 0) return
        // 줄 번호가 밀렸으므로 이전 표시는 바로 지우고 편집이 멈춘 뒤 다시 계산한다
        this.clear()
        this.schedule(EDIT_DELAY)
      }),
      vscode.workspace.onDidCloseTextDocument((doc) => this.cache.delete(doc.uri.toString())),
      vscode.window.onDidChangeWindowState((state) => {
        if (state.focused) this.schedule(0)
      }),
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('gitScope.blame') || e.affectsConfiguration('gitScope.language')) {
          this.schedule(0)
        }
      }),
      vscode.languages.registerHoverProvider({ scheme: 'file' }, { provideHover: (doc, pos) => this.hover(doc, pos) }),
      vscode.commands.registerCommand(SHOW_COMMIT_COMMAND, (args?: ShowCommitArgs) => this.showCommit(args)),
      vscode.commands.registerCommand('gitScope.blame.toggle', () => {
        const config = vscode.workspace.getConfiguration('gitScope')
        void config.update('blame.enabled', !this.enabled(), vscode.ConfigurationTarget.Global)
      }),
    )
    this.schedule(0)
  }

  dispose(): void {
    clearTimeout(this.timer)
    for (const d of this.disposables) d.dispose()
  }

  private enabled(): boolean {
    return vscode.workspace.getConfiguration('gitScope').get<boolean>('blame.enabled', false)
  }

  private language(): BlameLanguage {
    return vscode.workspace.getConfiguration('gitScope').get<BlameLanguage>('language', 'en')
  }

  private schedule(delay: number): void {
    clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.update(), delay)
  }

  private clear(): void {
    this.shown = null
    for (const editor of vscode.window.visibleTextEditors) editor.setDecorations(this.decoration, [])
  }

  private async update(): Promise<void> {
    const editor = vscode.window.activeTextEditor
    if (!this.enabled() || !editor) {
      this.clear()
      return
    }
    const doc = editor.document
    const line = editor.selection.active.line
    const version = doc.version
    const found = await this.commitAt(doc, line)

    // 기다리는 동안 커서나 내용이 바뀌었으면 그쪽 갱신에 맡긴다
    if (
      editor !== vscode.window.activeTextEditor ||
      doc.version !== version ||
      editor.selection.active.line !== line
    ) {
      return
    }
    this.clear()
    if (!found) return

    this.shown = { uri: doc.uri.toString(), line, ...found }
    const end = doc.lineAt(line).range.end
    editor.setDecorations(this.decoration, [
      {
        range: new vscode.Range(end, end),
        renderOptions: { after: { contentText: inlineBlameText(found.commit, Date.now(), this.language()) } },
      },
    ])
  }

  private async commitAt(
    doc: vscode.TextDocument,
    line: number,
  ): Promise<{ commit: BlameCommit; repo: BlameRepo } | null> {
    if (doc.uri.scheme !== 'file' || doc.lineCount > MAX_LINES) return null
    const repo = await this.repoFor(path.dirname(doc.uri.fsPath))
    if (!repo) return null

    const key = doc.uri.toString()
    const stamp = await headStamp(repo.gitDir)
    let entry = this.cache.get(key)
    if (!entry || entry.version !== doc.version || entry.stamp !== stamp) {
      const relative = path.relative(repo.root, doc.uri.fsPath).split(path.sep).join('/')
      // 저장되지 않은 편집이 있으면 버퍼 내용 기준으로 계산해야 줄 번호가 맞는다
      const contents = doc.isDirty ? doc.getText() : undefined
      entry = {
        version: doc.version,
        stamp,
        // 추적되지 않는 파일 등은 표시하지 않는다 — 실패를 알림으로 띄우지 않는다
        lines: blameFile(repo.root, relative, contents).catch(() => null),
      }
      this.cache.set(key, entry)
    }
    const commit = (await entry.lines)?.[line]
    return commit ? { commit, repo } : null
  }

  private repoFor(dir: string): Promise<BlameRepo | null> {
    let repo = this.repos.get(dir)
    if (!repo) {
      repo = resolveBlameRepo(dir)
      this.repos.set(dir, repo)
    }
    return repo
  }

  /** blame을 표시 중인 줄이면 코드 위든 줄 끝 표시 위든 상세를 보여준다 */
  private hover(doc: vscode.TextDocument, pos: vscode.Position): vscode.Hover | undefined {
    const shown = this.shown
    if (!shown || shown.uri !== doc.uri.toString() || shown.line !== pos.line) return undefined

    const { commit, repo } = shown
    const lang = this.language()
    const md = new vscode.MarkdownString(undefined, true)
    md.isTrusted = { enabledCommands: [SHOW_COMMIT_COMMAND] }
    if (commit.uncommitted) {
      md.appendText(lang === 'ko' ? '아직 커밋되지 않은 줄입니다.' : 'This line has not been committed yet.')
      return new vscode.Hover(md)
    }

    const date = new Date(commit.authorTime * 1000).toLocaleString()
    md.appendMarkdown('**')
    md.appendText(commit.author)
    md.appendMarkdown('** ')
    md.appendText(`<${commit.authorEmail}>, ${relativeTime(commit.authorTime, Date.now(), lang)} (${date})`)
    md.appendMarkdown('\n\n')
    md.appendText(commit.summary)
    md.appendMarkdown('\n\n---\n\n')
    const args = encodeURIComponent(JSON.stringify({ root: repo.root, hash: commit.hash } satisfies ShowCommitArgs))
    const label = lang === 'ko' ? 'Git Scope 그래프에서 보기' : 'Show in Git Scope Graph'
    md.appendMarkdown(`$(git-commit) \`${commit.hash.slice(0, 7)}\` [${label}](command:${SHOW_COMMIT_COMMAND}?${args})`)
    return new vscode.Hover(md)
  }

  /** 링크로 호출되면 그 커밋을, 명령 팔레트로 호출되면 커서 줄의 커밋을 그래프에서 연다 */
  private async showCommit(args?: ShowCommitArgs): Promise<void> {
    if (args?.root && args.hash) {
      this.reveal(args.root, args.hash)
      return
    }
    const editor = vscode.window.activeTextEditor
    if (!editor) return
    const found = await this.commitAt(editor.document, editor.selection.active.line)
    if (!found) {
      void vscode.window.showInformationMessage('Git Scope: no git history for this line.')
      return
    }
    if (found.commit.uncommitted) {
      void vscode.window.showInformationMessage('Git Scope: this line has not been committed yet.')
      return
    }
    this.reveal(found.repo.root, found.commit.hash)
  }
}
