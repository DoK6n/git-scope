import { describe, expect, it } from 'vitest'
import { branchLeafName, buildBranchTree, leafBranches } from './branchTree'

describe('buildBranchTree', () => {
  it('세그먼트 없는 브랜치는 루트 바로 아래에 남는다', () => {
    const tree = buildBranchTree(['main', 'develop'])
    expect(tree.folders).toEqual([])
    expect(tree.branches).toEqual(['develop', 'main'])
  })

  it('`/` 세그먼트로 폴더를 만들고 정렬한다', () => {
    const tree = buildBranchTree(['origin/main', 'feature/login', 'feature/signup', 'main'])
    expect(tree.branches).toEqual(['main'])
    expect(tree.folders.map((f) => f.name)).toEqual(['feature', 'origin'])
    expect(tree.folders[0]!.branches).toEqual(['feature/login', 'feature/signup'])
    expect(tree.folders[1]!.branches).toEqual(['origin/main'])
  })

  it('브랜치 없이 하위 폴더 하나뿐인 체인은 압축한다', () => {
    const tree = buildBranchTree(['origin/feature/auth/login', 'origin/feature/auth/logout'])
    // origin > feature > auth 체인이 "origin/feature/auth" 하나로 압축된다
    expect(tree.folders).toHaveLength(1)
    expect(tree.folders[0]!.name).toBe('origin/feature/auth')
    expect(tree.folders[0]!.branches).toEqual([
      'origin/feature/auth/login',
      'origin/feature/auth/logout',
    ])
  })

  it('폴더 path는 루트부터의 접두 경로다 (펼침 상태 키)', () => {
    const tree = buildBranchTree(['origin/main', 'origin/feature/a', 'origin/feature/b'])
    const origin = tree.folders[0]!
    expect(origin.path).toBe('origin')
    expect(origin.folders[0]!.path).toBe('origin/feature')
  })
})

describe('leafBranches', () => {
  it('하위 폴더를 포함한 모든 브랜치 전체 이름을 모은다', () => {
    const tree = buildBranchTree(['origin/main', 'origin/feature/a', 'origin/feature/b'])
    expect(leafBranches(tree.folders[0]!).sort()).toEqual([
      'origin/feature/a',
      'origin/feature/b',
      'origin/main',
    ])
  })
})

describe('branchLeafName', () => {
  it('마지막 세그먼트만 돌려준다', () => {
    expect(branchLeafName('origin/feature/login')).toBe('login')
    expect(branchLeafName('main')).toBe('main')
  })
})
