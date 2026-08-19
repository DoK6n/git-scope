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

/** Claude 공동 작성 커밋의 noreply@anthropic.com — 번들된 아이콘 사용 */
export function isClaudeEmail(email: string): boolean {
  return /@anthropic\.com$/i.test(email.trim())
}

export function fetchAvatar(
  repo: string,
  email: string,
  commitHash: string,
  size = 16,
  /** co-author는 커밋 API로 조회하면 주 작성자 아바타가 나오므로 Gravatar만 쓴다 */
  viaGitHub = true,
): Promise<string | null> {
  if (isClaudeEmail(email)) return Promise.resolve(claudeIcon)
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
