import type { Commit } from '@shared-types/domain'

export type FixupKind = 'fixup' | 'squash' | 'amend'

/** 제목이 fixup!/squash!/amend! 로 시작하면 그 종류를 돌려준다 */
export function fixupKind(subject: string): FixupKind | null {
  const match = /^(fixup|squash|amend)! /.exec(subject)
  return (match?.[1] as FixupKind | undefined) ?? null
}

/** 접두사를 전부 벗긴 대상 커밋 제목 ("fixup! fixup! msg" → "msg") */
export function fixupTargetSubject(subject: string): string {
  let result = subject
  while (/^(fixup|squash|amend)! /.test(result)) {
    result = result.replace(/^(fixup|squash|amend)! /, '')
  }
  return result
}

/**
 * fixup 커밋의 대상 커밋을 로드된 커밋에서 찾는다 — fixup보다 오래된(인덱스 큰) 커밋 중
 * 제목이 정확히 일치하는 첫 커밋. 없으면 git autosquash처럼 접두 일치로 폴백.
 */
export function findFixupTarget(commits: readonly Commit[], fixupIndex: number): Commit | null {
  const target = fixupTargetSubject(commits[fixupIndex]!.subject)
  let prefixMatch: Commit | null = null
  for (let i = fixupIndex + 1; i < commits.length; i++) {
    const commit = commits[i]!
    if (commit.isUncommitted || commit.stashSelector) continue
    if (commit.subject === target) return commit
    if (prefixMatch === null && commit.subject.startsWith(target)) prefixMatch = commit
  }
  return prefixMatch
}
