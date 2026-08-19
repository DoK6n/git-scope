import { readFileSync } from 'node:fs'

/** ~/.taskly-token 파일에서 API 토큰을 읽는다 */
export function loadToken(path: string): string | null {
  try {
    return readFileSync(path, 'utf8').trim() || null
  } catch {
    return null
  }
}

/** 토큰 만료(발급 후 30일) 검사 */
export function isExpired(issuedAt: string): boolean {
  const age = Date.now() - new Date(issuedAt).getTime()
  return age > 30 * 24 * 60 * 60 * 1000
}
