import type { CommitLineStats } from '@shared-types/domain'
import type { NumstatEntry } from './parse'

interface StatFile extends NumstatEntry {
  path: string
}

interface CommentSyntax {
  line: string[]
  block: [string, string][]
}

const C_STYLE: CommentSyntax = { line: ['//'], block: [['/*', '*/']] }
const HASH_STYLE: CommentSyntax = { line: ['#'], block: [] }
const HTML_STYLE: CommentSyntax = { line: [], block: [['<!--', '-->']] }

const SYNTAX_BY_EXTENSION: Record<string, CommentSyntax> = {
  '.c': C_STYLE,
  '.cc': C_STYLE,
  '.cpp': C_STYLE,
  '.cxx': C_STYLE,
  '.h': C_STYLE,
  '.hh': C_STYLE,
  '.hpp': C_STYLE,
  '.java': C_STYLE,
  '.js': C_STYLE,
  '.jsx': C_STYLE,
  '.kt': C_STYLE,
  '.kts': C_STYLE,
  '.m': C_STYLE,
  '.mm': C_STYLE,
  '.rs': C_STYLE,
  '.swift': C_STYLE,
  '.ts': C_STYLE,
  '.tsx': C_STYLE,
  '.css': { line: [], block: [['/*', '*/']] },
  '.scss': C_STYLE,
  '.less': C_STYLE,
  '.json': { line: [], block: [] },
  '.jsonc': C_STYLE,
  '.py': HASH_STYLE,
  '.pyi': HASH_STYLE,
  '.rb': HASH_STYLE,
  '.sh': HASH_STYLE,
  '.bash': HASH_STYLE,
  '.zsh': HASH_STYLE,
  '.fish': HASH_STYLE,
  '.yaml': HASH_STYLE,
  '.yml': HASH_STYLE,
  '.toml': HASH_STYLE,
  '.r': HASH_STYLE,
  '.sql': { line: ['--'], block: [['/*', '*/']] },
  '.html': HTML_STYLE,
  '.htm': HTML_STYLE,
  '.xml': HTML_STYLE,
  '.svg': HTML_STYLE,
  '.md': HTML_STYLE,
  '.txt': { line: [], block: [] },
}

const SYNTAX_BY_NAME: Record<string, CommentSyntax> = {
  Dockerfile: HASH_STYLE,
  Makefile: HASH_STYLE,
  Rakefile: HASH_STYLE,
}

function syntaxFor(path: string): CommentSyntax | undefined {
  const clean = path.replace(/^['"]|['"]$/g, '')
  const name = clean.slice(clean.lastIndexOf('/') + 1)
  const byName = SYNTAX_BY_NAME[name]
  if (byName) return byName
  const dot = name.lastIndexOf('.')
  return dot < 0 ? undefined : SYNTAX_BY_EXTENSION[name.slice(dot).toLowerCase()]
}

interface CommentState {
  blockEnd: string | null
}

/** true면 공백 또는 주석만 있는 줄. 코드 뒤의 인라인 주석은 코드 줄로 남겨둔다. */
function isIgnorable(line: string, syntax: CommentSyntax, state: CommentState): boolean {
  let rest = line.trim()
  if (rest === '') return true

  if (state.blockEnd !== null) {
    const end = rest.indexOf(state.blockEnd)
    if (end < 0) return true
    rest = rest.slice(end + state.blockEnd.length).trim()
    state.blockEnd = null
    if (rest === '') return true
  }

  if (syntax.line.some((prefix) => rest.startsWith(prefix))) return true

  // hunk 밖에서 열린 C-style 주석의 중간·닫힘 줄도 일반적인 형태는 주석으로 본다.
  if (syntax.block.some(([open]) => open === '/*') && (rest.startsWith('*') || rest.startsWith('*/'))) {
    const closing = rest.indexOf('*/')
    if (closing < 0 || rest.slice(closing + 2).trim() === '') return true
    rest = rest.slice(closing + 2).trim()
  }

  for (const [open, close] of syntax.block) {
    if (!rest.startsWith(open)) continue
    const end = rest.indexOf(close, open.length)
    if (end < 0) {
      state.blockEnd = close
      return true
    }
    rest = rest.slice(end + close.length).trim()
    if (rest === '') return true
    return isIgnorable(rest, syntax, state)
  }

  return false
}

function headerPath(line: string): string | null {
  const value = line.slice(4)
  if (value === '/dev/null') return null
  // --no-prefix로 출력하므로 접두사는 없다. 탭 이후 timestamp가 있는 형식도 방어한다.
  return value.split('\t', 1)[0] ?? null
}

/**
 * unified=0 patch에서 공백·주석 전용 변경 줄을 찾아 raw numstat에서 뺀다.
 * 파싱하지 못한 파일은 raw가 그대로 남으므로 안전하게 폴백한다.
 */
export function calculateCommitLineStats(files: StatFile[], patch: string): CommitLineStats {
  let rawAdditions = 0
  let rawDeletions = 0
  let fallbackFiles = 0
  let binaryFiles = 0
  for (const file of files) {
    if (file.additions === undefined || file.deletions === undefined) {
      binaryFiles++
      continue
    }
    rawAdditions += file.additions
    rawDeletions += file.deletions
    if (!syntaxFor(file.path)) fallbackFiles++
  }

  let ignoredAdditions = 0
  let ignoredDeletions = 0
  let oldPath: string | null = null
  let syntax: CommentSyntax | undefined
  let inHunk = false
  const addedState: CommentState = { blockEnd: null }
  const deletedState: CommentState = { blockEnd: null }

  for (const line of patch.split('\n')) {
    if (line.startsWith('diff --git ')) {
      oldPath = null
      syntax = undefined
      inHunk = false
      addedState.blockEnd = null
      deletedState.blockEnd = null
      continue
    }
    if (!inHunk && line.startsWith('--- ')) {
      oldPath = headerPath(line)
      continue
    }
    if (!inHunk && line.startsWith('+++ ')) {
      syntax = syntaxFor(headerPath(line) ?? oldPath ?? '')
      continue
    }
    if (line.startsWith('@@')) {
      inHunk = true
      continue
    }
    if (!inHunk || !syntax) continue
    if (line.startsWith('+') && isIgnorable(line.slice(1), syntax, addedState)) {
      ignoredAdditions++
    } else if (line.startsWith('-') && isIgnorable(line.slice(1), syntax, deletedState)) {
      ignoredDeletions++
    }
  }

  return {
    additions: Math.max(0, rawAdditions - ignoredAdditions),
    deletions: Math.max(0, rawDeletions - ignoredDeletions),
    rawAdditions,
    rawDeletions,
    fallbackFiles,
    binaryFiles,
  }
}
