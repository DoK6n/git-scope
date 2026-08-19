import type { FileChange } from '@shared-types/domain'

/** 변경 파일 트리 노드 — 폴더는 중간에 자식이 하나뿐이면 경로를 합쳐 표시한다 */
export interface FileTreeFolder {
  /** 표시명 (압축된 경우 "src/webview/app" 형태) */
  name: string
  folders: FileTreeFolder[]
  files: FileChange[]
}

interface MutableFolder {
  name: string
  children: Map<string, MutableFolder>
  files: FileChange[]
}

/** FileChange 목록을 폴더 트리로 변환 (단일 자식 폴더 체인은 압축) */
export function buildFileTree(files: FileChange[]): FileTreeFolder {
  const root: MutableFolder = { name: '', children: new Map(), files: [] }

  for (const file of files) {
    const segments = file.path.split('/')
    let node = root
    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i]!
      let child = node.children.get(segment)
      if (!child) {
        child = { name: segment, children: new Map(), files: [] }
        node.children.set(segment, child)
      }
      node = child
    }
    node.files.push(file)
  }

  return finalize(root, true)
}

function finalize(node: MutableFolder, isRoot = false): FileTreeFolder {
  let name = node.name
  let current = node
  // 파일 없이 하위 폴더 하나뿐인 체인은 "a/b/c"로 압축한다 (루트는 압축하지 않음)
  while (!isRoot && current.files.length === 0 && current.children.size === 1) {
    const child = [...current.children.values()][0]!
    name = name === '' ? child.name : `${name}/${child.name}`
    current = child
  }
  const folders = [...current.children.values()]
    .map((child) => finalize(child))
    .sort((a, b) => a.name.localeCompare(b.name))
  const sortedFiles = [...current.files].sort((a, b) => a.path.localeCompare(b.path))
  return { name, folders, files: sortedFiles }
}

/** 파일 경로의 마지막 조각 (트리 표시용) */
export function basename(path: string): string {
  const idx = path.lastIndexOf('/')
  return idx >= 0 ? path.slice(idx + 1) : path
}
