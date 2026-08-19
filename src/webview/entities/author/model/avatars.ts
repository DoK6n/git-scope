import { request } from '../../../shared/api'
import { gravatarUrl } from '../../../shared/lib'

/**
 * 이메일별 아바타 URL 캐시 (세션 메모리).
 * host의 getAvatar(GitHub API + 디스크 캐시)를 먼저 시도하고,
 * 아바타가 없거나 GitHub 리포가 아니면 Gravatar(identicon)로 대체한다.
 * 둘 다 불가능하면 null — UI는 이니셜 원형으로 폴백.
 */
const cache = new Map<string, Promise<string | null>>()

import claudeIcon from '../assets/claude-icon.png'
import codexIcon from '../assets/codex-icon.png'

/**
 * AI 공동 작성자 전용 아이콘 — Co-authored-by 이름(claude/codex 포함 여부)
 * 또는 이메일 도메인으로 판별한다.
 */
export function specialIcon(name: string, email: string): string | null {
  const n = name.toLowerCase()
  const e = email.trim().toLowerCase()
  if (n.includes('claude') || e.endsWith('@anthropic.com')) return claudeIcon
  if (n.includes('codex') || e.endsWith('@openai.com')) return codexIcon
  return null
}

export function fetchAvatar(
  repo: string,
  name: string,
  email: string,
  commitHash: string,
  size = 16,
  /** co-author는 커밋 API로 조회하면 주 작성자 아바타가 나오므로 Gravatar만 쓴다 */
  viaGitHub = true,
): Promise<string | null> {
  const icon = specialIcon(name, email)
  if (icon) return Promise.resolve(icon)
  const key = email.trim().toLowerCase()
  if (key === '') return Promise.resolve(null)
  let promise = cache.get(key)
  if (!promise) {
    promise = (
      viaGitHub
        ? request('getAvatar', { repo, email, commitHash }).then(
            (r) => r.dataUri ?? gravatarUrl(email, size * 2),
          )
        : gravatarUrl(email, size * 2)
    )
      .catch(() => gravatarUrl(email, size * 2).catch(() => null))
      .catch(() => null)
    cache.set(key, promise)
  }
  return promise
}

export { hashColor as letterColor } from '../../../shared/lib'
