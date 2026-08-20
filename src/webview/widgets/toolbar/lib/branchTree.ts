/** 브랜치 필터 트리 노드 — `/` 구분 세그먼트로 그룹핑, 단일 하위 폴더 체인은 압축 */
export interface BranchTreeFolder {
  /** 표시명 (압축된 경우 "feature/auth" 형태) */
  name: string
  /** 루트부터의 전체 접두 경로 — 펼침 상태 키로 쓴다 */
  path: string
  folders: BranchTreeFolder[]
  /** 이 폴더 바로 아래의 브랜치 전체 이름 (leaf) */
  branches: string[]
}

interface MutableFolder {
  name: string
  children: Map<string, MutableFolder>
  branches: string[]
}

/** 브랜치 이름 목록을 폴더 트리로 변환 (예: origin/feature/a → origin > feature > a) */
export function buildBranchTree(names: string[]): BranchTreeFolder {
  const root: MutableFolder = { name: '', children: new Map(), branches: [] }

  for (const name of names) {
    const segments = name.split('/')
    let node = root
    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i]!
      let child = node.children.get(segment)
      if (!child) {
        child = { name: segment, children: new Map(), branches: [] }
        node.children.set(segment, child)
      }
      node = child
    }
    node.branches.push(name)
  }

  return finalize(root, '', true)
}

function finalize(node: MutableFolder, parentPath: string, isRoot = false): BranchTreeFolder {
  let name = node.name
  let current = node
  // 브랜치 없이 하위 폴더 하나뿐인 체인은 "a/b"로 압축한다 (루트는 압축하지 않음)
  while (!isRoot && current.branches.length === 0 && current.children.size === 1) {
    const child = [...current.children.values()][0]!
    name = name === '' ? child.name : `${name}/${child.name}`
    current = child
  }
  const path = isRoot ? '' : parentPath === '' ? name : `${parentPath}/${name}`
  const folders = [...current.children.values()]
    .map((child) => finalize(child, path))
    .sort((a, b) => a.name.localeCompare(b.name))
  const branches = [...current.branches].sort((a, b) => a.localeCompare(b))
  return { name, path, folders, branches }
}

/** 폴더 아래의 모든 브랜치 전체 이름 (폴더 체크박스 = 하위 일괄 토글용) */
export function leafBranches(folder: BranchTreeFolder): string[] {
  return [...folder.branches, ...folder.folders.flatMap(leafBranches)]
}

/** 브랜치 이름의 마지막 세그먼트 (트리 leaf 표시용) */
export function branchLeafName(name: string): string {
  const idx = name.lastIndexOf('/')
  return idx >= 0 ? name.slice(idx + 1) : name
}
