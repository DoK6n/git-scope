import { createSignal } from 'solid-js'
import type { IconSpec } from '@shared-types/domain'
import { request } from '../../../shared/api'

/**
 * 활성 아이콘 테마의 파일/폴더 아이콘 캐시.
 * host가 테마 정의를 해석해 svg URI 또는 폰트 글리프를 내려준다.
 */
const fileIcons = new Map<string, IconSpec | null>()
const folderIcons = new Map<string, IconSpec | null>()
const [version, setVersion] = createSignal(0)
let fontsInjected = false
let inflight: Promise<void> | null = null

/** 필요한 이름들의 아이콘을 (없는 것만) host에서 로드한다 */
export async function ensureIcons(files: string[], folders: string[]): Promise<void> {
  const needFiles = [...new Set(files)].filter((n) => !fileIcons.has(n))
  const needFolders = [...new Set(folders)].filter((n) => !folderIcons.has(`${n}:0`))
  if (needFiles.length === 0 && needFolders.length === 0) return
  if (inflight) await inflight

  inflight = (async () => {
    const result = await request('getFileIcons', { files: needFiles, folders: needFolders })
    for (const [name, spec] of Object.entries(result.files)) fileIcons.set(name, spec)
    for (const [name, spec] of Object.entries(result.foldersCollapsed))
      folderIcons.set(`${name}:0`, spec)
    for (const [name, spec] of Object.entries(result.foldersExpanded))
      folderIcons.set(`${name}:1`, spec)

    // 폰트 기반 테마(Seti 등): CSSOM으로 @font-face 주입 (CSP style-src 제약 회피)
    if (!fontsInjected && result.fonts.length > 0) {
      const sheet = new CSSStyleSheet()
      sheet.replaceSync(
        result.fonts
          .map(
            (f) =>
              `@font-face{font-family:'gs-fileicon-${f.id}';src:url('${f.src}') format('${f.format}');}`,
          )
          .join('\n'),
      )
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]
      fontsInjected = true
    }
    setVersion((v) => v + 1)
  })().finally(() => {
    inflight = null
  })
  await inflight
}

export function getFileIcon(name: string): IconSpec | null | undefined {
  version()
  return fileIcons.get(name)
}

export function getFolderIcon(name: string, expanded: boolean): IconSpec | null | undefined {
  version()
  return folderIcons.get(`${name}:${expanded ? 1 : 0}`)
}
