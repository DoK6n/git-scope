import { readFileSync } from 'node:fs'

/** ~/.taskly-token 파일에서 API 토큰을 읽는다 */
export function loadToken(path: string): string | null {
  try {
    return readFileSync(path, 'utf8').trim() || null
  } catch {
    return null
  }
}
