/** 검색어에 glob 메타문자가 포함되어 있는지 */
export function isGlobPattern(query: string): boolean {
  return /[*?[]/.test(query)
}

/**
 * glob 패턴을 앵커된(전체 일치) 정규식으로 변환한다.
 * `*` = 임의 문자열, `?` = 임의 한 문자, `[...]`/`[!...]` = 문자 클래스.
 * 유효하지 않은 패턴(닫히지 않은 `[`)이면 null.
 */
export function globToRegExp(pattern: string): RegExp | null {
  let source = '^'
  let i = 0
  while (i < pattern.length) {
    const ch = pattern[i]!
    if (ch === '*') {
      source += '.*'
      i++
    } else if (ch === '?') {
      source += '.'
      i++
    } else if (ch === '[') {
      let j = i + 1
      let cls = ''
      if (pattern[j] === '!' || pattern[j] === '^') {
        cls += '^'
        j++
      }
      // 첫 문자가 ']'면 리터럴로 취급
      if (pattern[j] === ']') {
        cls += '\\]'
        j++
      }
      while (j < pattern.length && pattern[j] !== ']') {
        const c = pattern[j]!
        cls += c === '\\' ? '\\\\' : c
        j++
      }
      if (j >= pattern.length) return null
      source += `[${cls}]`
      i = j + 1
    } else {
      source += ch.replace(/[.+^${}()|\\\]]/g, '\\$&')
      i++
    }
  }
  source += '$'
  try {
    return new RegExp(source, 'i')
  } catch {
    return null
  }
}

/**
 * 검색어로 매칭 함수를 만든다.
 * glob 메타문자가 있으면 앵커된 glob 매칭, 아니면(또는 패턴이 유효하지 않으면)
 * 대소문자 무시 부분 문자열 매칭으로 폴백.
 */
export function makeMatcher(query: string): (text: string) => boolean {
  if (isGlobPattern(query)) {
    const re = globToRegExp(query)
    if (re) return (text) => re.test(text)
  }
  const lowered = query.toLowerCase()
  return (text) => text.toLowerCase().includes(lowered)
}
