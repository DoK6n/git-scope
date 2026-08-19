import { describe, expect, it } from 'vitest'
import type { FileChange } from '@shared-types/domain'
import { basename, buildFileTree } from './fileTree'

const f = (path: string): FileChange => ({ status: 'M', path })

describe('buildFileTree', () => {
  it('경로를 폴더 트리로 변환한다', () => {
    const tree = buildFileTree([f('src/a.ts'), f('src/b.ts'), f('README.md')])
    expect(tree.files.map((x) => x.path)).toEqual(['README.md'])
    expect(tree.folders).toHaveLength(1)
    expect(tree.folders[0]!.name).toBe('src')
    expect(tree.folders[0]!.files.map((x) => x.path)).toEqual(['src/a.ts', 'src/b.ts'])
  })

  it('단일 자식 폴더 체인은 압축된다', () => {
    const tree = buildFileTree([f('src/webview/app/index.tsx'), f('src/webview/app/App.tsx')])
    expect(tree.folders).toHaveLength(1)
    expect(tree.folders[0]!.name).toBe('src/webview/app')
    expect(tree.folders[0]!.files).toHaveLength(2)
  })

  it('파일이 있는 폴더는 압축을 멈춘다', () => {
    const tree = buildFileTree([f('src/main.ts'), f('src/git/exec.ts')])
    expect(tree.folders[0]!.name).toBe('src')
    expect(tree.folders[0]!.files.map((x) => x.path)).toEqual(['src/main.ts'])
    expect(tree.folders[0]!.folders[0]!.name).toBe('git')
  })

  it('폴더·파일이 알파벳 순으로 정렬된다', () => {
    const tree = buildFileTree([f('b/x.ts'), f('a/y.ts'), f('z.ts'), f('a.ts')])
    expect(tree.folders.map((x) => x.name)).toEqual(['a', 'b'])
    expect(tree.files.map((x) => x.path)).toEqual(['a.ts', 'z.ts'])
  })
})

describe('basename', () => {
  it('마지막 경로 조각을 돌려준다', () => {
    expect(basename('src/a/b.ts')).toBe('b.ts')
    expect(basename('b.ts')).toBe('b.ts')
  })
})
