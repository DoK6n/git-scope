/**
 * 이메일 → Gravatar URL. SHA-256 해시 방식(Gravatar 공식 지원),
 * 등록되지 않은 이메일은 identicon이 자동 생성된다.
 * 해시 계산은 비동기(crypto.subtle)라 이메일별로 캐시한다.
 */
const cache = new Map<string, Promise<string>>()

export function gravatarUrl(email: string, size = 32): Promise<string> {
  const normalized = email.trim().toLowerCase()
  const key = `${normalized}:${size}`
  let promise = cache.get(key)
  if (!promise) {
    promise = crypto.subtle
      .digest('SHA-256', new TextEncoder().encode(normalized))
      .then((buffer) => {
        const hex = [...new Uint8Array(buffer)]
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')
        return `https://www.gravatar.com/avatar/${hex}?s=${size}&d=identicon`
      })
    cache.set(key, promise)
  }
  return promise
}
