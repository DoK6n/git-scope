import * as fs from 'node:fs'
import * as path from 'node:path'
import * as vscode from 'vscode'
import type { IconSpec } from '@shared-types/domain'

/** VS Code File Icon Theme 정의 JSON의 우리가 쓰는 부분 (공식 문서화된 포맷) */
interface ThemeJson {
  iconDefinitions?: Record<
    string,
    {
      iconPath?: string
      fontCharacter?: string
      fontColor?: string
      fontSize?: string
      fontId?: string
    }
  >
  file?: string
  folder?: string
  folderExpanded?: string
  fileExtensions?: Record<string, string>
  fileNames?: Record<string, string>
  folderNames?: Record<string, string>
  folderNamesExpanded?: Record<string, string>
  fonts?: {
    id: string
    src: { path: string; format: string }[]
  }[]
}

interface LoadedTheme {
  themeId: string
  /** 테마 JSON이 있는 디렉토리 — iconPath/폰트 경로의 기준 */
  dir: string
  /** 테마 익스텐션 루트 — 아이콘이 dir 밖(../icons 등)에 있을 수 있어 리소스 루트는 이걸 쓴다 */
  extensionRoot: string
  json: ThemeJson
}

/**
 * 활성 파일 아이콘 테마(workbench.iconTheme)를 제공하는 익스텐션의
 * 테마 정의를 읽어 파일/폴더 아이콘을 해석한다.
 * webview는 아이콘 테마에 접근할 수 없으므로 host가 대신 읽어 전달한다.
 */
export class FileIconService {
  private cache: LoadedTheme | null = null
  private cachedThemeId: string | null | undefined

  private load(): LoadedTheme | null {
    const themeId =
      vscode.workspace.getConfiguration('workbench').get<string | null>('iconTheme') ?? null
    if (this.cachedThemeId === themeId) return this.cache
    this.cachedThemeId = themeId
    this.cache = null
    if (!themeId) return null

    for (const ext of vscode.extensions.all) {
      const iconThemes = (
        ext.packageJSON as {
          contributes?: { iconThemes?: { id: string; path: string }[] }
        }
      ).contributes?.iconThemes
      const contribution = iconThemes?.find((t) => t.id === themeId)
      if (!contribution) continue
      try {
        const jsonPath = path.join(ext.extensionPath, contribution.path)
        const json = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as ThemeJson
        this.cache = {
          themeId,
          dir: path.dirname(jsonPath),
          extensionRoot: ext.extensionPath,
          json,
        }
      } catch {
        this.cache = null
      }
      break
    }
    return this.cache
  }

  /** webview localResourceRoots에 추가할 테마 익스텐션 루트 */
  themeDir(): string | null {
    return this.load()?.extensionRoot ?? null
  }

  /** 폰트 기반 테마(Seti 등)의 @font-face 정보 — src는 절대 fsPath */
  fonts(): { id: string; src: string; format: string }[] {
    const theme = this.load()
    if (!theme?.json.fonts) return []
    return theme.json.fonts.flatMap((font) => {
      const src = font.src[0]
      return src ? [{ id: font.id, src: path.join(theme.dir, src.path), format: src.format }] : []
    })
  }

  private toSpec(defId: string | undefined): IconSpec | null {
    const theme = this.load()
    if (!theme || !defId) return null
    const def = theme.json.iconDefinitions?.[defId]
    if (!def) return null
    if (def.iconPath) return { svg: path.join(theme.dir, def.iconPath) }
    if (def.fontCharacter !== undefined) {
      // "\E058" 같은 이스케이프 표기는 실제 유니코드 문자로 변환 (Seti 등 폰트 테마)
      const escaped = /^\\([0-9a-fA-F]{1,6})$/.exec(def.fontCharacter)
      const fontChar = escaped
        ? String.fromCodePoint(parseInt(escaped[1]!, 16))
        : def.fontCharacter
      return {
        fontChar,
        fontColor: def.fontColor,
        fontSize: def.fontSize,
        fontId: def.fontId ?? theme.json.fonts?.[0]?.id,
      }
    }
    return null
  }

  /** 파일명 → 아이콘. fileNames > (다중 확장자 우선) fileExtensions > file 기본값 */
  fileIcon(name: string): IconSpec | null {
    const theme = this.load()
    if (!theme) return null
    const lower = name.toLowerCase()
    const byName = theme.json.fileNames?.[lower]
    if (byName) return this.toSpec(byName)
    const parts = lower.split('.')
    for (let i = 1; i < parts.length; i++) {
      const id = theme.json.fileExtensions?.[parts.slice(i).join('.')]
      if (id) return this.toSpec(id)
    }
    return this.toSpec(theme.json.file)
  }

  folderIcon(name: string, expanded: boolean): IconSpec | null {
    const theme = this.load()
    if (!theme) return null
    const lower = name.toLowerCase()
    if (expanded) {
      return this.toSpec(
        theme.json.folderNamesExpanded?.[lower] ??
          theme.json.folderExpanded ??
          theme.json.folderNames?.[lower] ??
          theme.json.folder,
      )
    }
    return this.toSpec(theme.json.folderNames?.[lower] ?? theme.json.folder)
  }
}
