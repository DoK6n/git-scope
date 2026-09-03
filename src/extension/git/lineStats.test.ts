import { describe, expect, it } from 'vitest'
import { calculateCommitLineStats } from './lineStats'

describe('calculateCommitLineStats', () => {
  it('공백과 주석 전용 라인만 실질 수치에서 제외한다', () => {
    const patch = [
      'diff --git src/a.ts src/a.ts',
      '--- src/a.ts',
      '+++ src/a.ts',
      '@@ -1,5 +1,6 @@',
      '-// old comment',
      '-const oldValue = 1 // code remains effective',
      '-   ',
      '+// new comment',
      '+const newValue = 2 // code remains effective',
      '+',
      '+/* block comment',
      '+ * continued',
      '+ */',
    ].join('\n')

    expect(
      calculateCommitLineStats([{ path: 'src/a.ts', additions: 6, deletions: 3 }], patch),
    ).toEqual({
      additions: 1,
      deletions: 1,
      rawAdditions: 6,
      rawDeletions: 3,
      fallbackFiles: 0,
      binaryFiles: 0,
    })
  })

  it('rename은 새 확장자로 판정하고 바이너리는 합계에 섞지 않는다', () => {
    const patch = [
      'diff --git old/name.txt src/name.ts',
      'similarity index 70%',
      'rename from old/name.txt',
      'rename to src/name.ts',
      '--- old/name.txt',
      '+++ src/name.ts',
      '@@ -1 +1,2 @@',
      '-old value',
      '+// renamed comment',
      '+newValue()',
      'diff --git assets/logo.png assets/logo.png',
      'Binary files assets/logo.png and assets/logo.png differ',
    ].join('\n')

    expect(
      calculateCommitLineStats(
        [
          { path: 'src/name.ts', additions: 2, deletions: 1 },
          { path: 'assets/logo.png' },
        ],
        patch,
      ),
    ).toEqual({
      additions: 1,
      deletions: 1,
      rawAdditions: 2,
      rawDeletions: 1,
      fallbackFiles: 0,
      binaryFiles: 1,
    })
  })

  it('미지원 확장자는 raw numstat으로 폴백한다', () => {
    const patch = [
      'diff --git data/example.custom data/example.custom',
      '--- data/example.custom',
      '+++ data/example.custom',
      '@@ -1 +1 @@',
      '-# old',
      '+# new',
    ].join('\n')

    expect(
      calculateCommitLineStats(
        [{ path: 'data/example.custom', additions: 1, deletions: 1 }],
        patch,
      ),
    ).toEqual({
      additions: 1,
      deletions: 1,
      rawAdditions: 1,
      rawDeletions: 1,
      fallbackFiles: 1,
      binaryFiles: 0,
    })
  })

  it('삭제된 HTML 파일은 old path의 문법을 쓴다', () => {
    const patch = [
      'diff --git page.html page.html',
      'deleted file mode 100644',
      '--- page.html',
      '+++ /dev/null',
      '@@ -1,2 +0,0 @@',
      '-<!-- removed note -->',
      '-<main>content</main>',
    ].join('\n')

    expect(
      calculateCommitLineStats([{ path: 'page.html', additions: 0, deletions: 2 }], patch),
    ).toMatchObject({ additions: 0, deletions: 1, rawAdditions: 0, rawDeletions: 2 })
  })
})
