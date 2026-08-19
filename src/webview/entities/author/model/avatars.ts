import { request } from '../../../shared/api'
import { gravatarUrl } from '../../../shared/lib'

/**
 * 이메일별 아바타 URL 캐시 (세션 메모리).
 * host의 getAvatar(GitHub API + 디스크 캐시)를 먼저 시도하고,
 * 아바타가 없거나 GitHub 리포가 아니면 Gravatar(identicon)로 대체한다.
 * 둘 다 불가능하면 null — UI는 이니셜 원형으로 폴백.
 */
const cache = new Map<string, Promise<string | null>>()

export function fetchAvatar(
  repo: string,
  email: string,
  commitHash: string,
  size = 16,
): Promise<string | null> {
  const key = email.trim().toLowerCase()
  if (key === '') return Promise.resolve(null)
  let promise = cache.get(key)
  if (!promise) {
    promise = request('getAvatar', { repo, email, commitHash })
      .then((r) => r.dataUri ?? gravatarUrl(email, size * 2))
      .catch(() => gravatarUrl(email, size * 2).catch(() => null))
      .catch(() => null)
    cache.set(key, promise)
  }
  return promise
}

export { hashColor as letterColor } from '../../../shared/lib'
