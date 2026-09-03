import { createSignal } from 'solid-js'

export type Locale = 'en' | 'ko'

/** UI 언어 — gitScope.language 설정이 반영된다 (store가 settings 수신 시 setLocale) */
const [locale, setLocale] = createSignal<Locale>('en')
export { locale, setLocale }

/**
 * UI 문구 조회 — 영어 원문이 키. locale이 ko면 사전에서 찾고 없으면 원문 그대로.
 * `{0}` `{1}` 자리에 인자가 순서대로 치환된다. JSX에서 호출하면 locale 변경에 반응한다.
 */
export function t(text: string, ...args: (string | number)[]): string {
  const template = locale() === 'ko' ? (KO[text] ?? text) : text
  return template.replace(/\{(\d+)\}/g, (_, index: string) => String(args[Number(index)] ?? ''))
}

/** 영어 원문 → 한국어. 원문이 곧 키라 영어 문구 수정 시 사전도 함께 고쳐야 한다 */
const KO: Record<string, string> = {
  // ── 공통 ──
  'Commit not found in the graph.': '해당 커밋을 그래프에서 찾을 수 없습니다.',

  // ── 툴바 · 브랜치 필터 ──
  'Select branches to show in the graph': '그래프에 표시할 브랜치 선택',
  'Show remote branches in the graph': '원격 브랜치를 그래프에 표시',
  'Filter Branches… (glob: feature/*)': '브랜치 필터… (glob: feature/*)',
  'No matching branches': '일치하는 브랜치 없음',
  'Select/unselect all branches under this folder': '하위 브랜치 일괄 선택/해제',
  '{0} branches': '{0}개 브랜치',
  'Search (glob: fix*, feat-?)': '검색 (glob 지원: fix*, feat-?)',
  'Open/close the stash panel': '스태시 목록 패널 열기/닫기',
  'Open/close the worktree panel': '워크트리 패널 열기/닫기',
  'Open/close author statistics': '작성자 통계 열기/닫기',
  Statistics: '통계',
  'Fetch — git fetch --all': 'Fetch — git fetch --all',
  'Fetch (prune) — clean up refs to branches deleted on the remote':
    'Fetch (prune) — 원격에서 삭제된 브랜치 참조 정리',
  'Fetched all remotes': 'git fetch --all 완료',
  'Fetched all remotes (prune)': 'git fetch --all --prune 완료',

  // ── 타임라인 ──
  'View mode': '보기 모드',
  Graph: '그래프',
  Timeline: '타임라인',
  'Commit Timeline': '커밋 타임라인',
  '{0} of {1} currently loaded commits': '현재 로드된 커밋 {1}개 중 {0}개',
  Author: '작성자',
  'Timeline author': '타임라인 작성자',
  'All authors': '모든 작성자',
  'Timeline interval': '타임라인 구간',
  Day: '일',
  Month: '월',
  Year: '연',
  'No loaded commits to show.': '표시할 로드된 커밋이 없습니다.',
  'Commit activity timeline': '커밋 활동 타임라인',
  '{0}: {1} commits': '{0}: 커밋 {1}개',
  'Timeline authors': '타임라인 작성자',
  'Timeline period: {0}': '타임라인 기간: {0}',
  '{0} commits': '커밋 {0}개',
  Clear: '지우기',

  // ── 그래프 · 뱃지 · 상세 ──
  'Double-click: git switch': '더블클릭: git switch',
  'HEAD — checked out branch': 'HEAD — 체크아웃된 브랜치',
  'checked out in a worktree': 'worktree에 체크아웃됨',
  'Double-click: fit to lane count': '더블클릭: 레인 수에 맞춤',
  'Click: go to target commit · autosquash via right-click menu':
    '클릭: 대상 커밋으로 이동 · 우클릭 메뉴에서 autosquash 실행',
  'Copy absolute path': '절대 경로 복사',
  'Open file': '파일 열기',
  'all changed files between the two commits': '두 커밋 사이의 모든 변경 파일',
  'Calculating lines…': '라인 수 계산 중…',
  'Line stats unavailable': '라인 수를 계산할 수 없음',
  'Raw numstat: +{0} / −{1}': '원시 numstat: +{0} / −{1}',
  '{0} unsupported file(s) use raw counts': '미지원 파일 {0}개는 원시 수치 사용',
  '{0} binary file(s) excluded': '바이너리 파일 {0}개는 합계에서 제외',
  merging: '머지 중',
  rebasing: '리베이스 중',
  'cherry-picking': '체리픽 중',
  reverting: '리버트 중',
  '{0} conflicts': '충돌 {0}개',
  Abort: '중단',
  'Abort {0}?': '{0} 작업을 중단할까요?',
  'This stops the {0} operation and returns the repository to the state before it started. Working tree and index changes made by the operation will be discarded.':
    '{0} 작업을 멈추고 저장소를 작업 시작 전 상태로 되돌립니다. 작업이 만든 워킹 트리와 인덱스 변경사항은 폐기됩니다.',
  '{0} operation aborted': '{0} 작업 중단 완료',
  'Unable to abort {0}': '{0} 작업을 중단할 수 없음',

  // ── 브랜치 액션 ──
  'Branch {0} created (from {1})': '브랜치 {0} 생성 완료 (from {1})',
  'Force delete (-D) — also deletes unmerged commits':
    'Force delete (-D) — 병합되지 않은 커밋도 삭제',
  'Unmerged commits may be lost.': '병합되지 않은 커밋이 유실될 수 있습니다.',

  // ── 원격 액션 ──
  'May overwrite remote branch history (--force-with-lease applies minimal protection).':
    '원격 브랜치 이력을 덮어쓸 수 있습니다 (--force-with-lease로 최소한의 보호만 적용).',
  'Pushed {0}': 'push {0} 완료',
  'Pull {0} into the current branch.': '{0}를 현재 브랜치로 pull 합니다.',
  'Pulled {0}': 'pull {0} 완료',
  'Deletes branch "{1}" on remote {0}. This is hard to undo.':
    '원격 {0}에서 브랜치 "{1}"을(를) 삭제합니다. 되돌리기 어렵습니다.',
  'Deleted remote branch {0}': '원격 브랜치 {0} 삭제 완료',
  'Fetches {0} into local branch {1} (fast-forward only).':
    '{0} → 로컬 {1} 브랜치로 fetch 합니다 (fast-forward만).',
  'Fetched {0} → {1}': 'fetch {0} → {1} 완료',
  'Pushed tag {0}': 'push tag {0} 완료',

  // ── merge / rebase / cherry-pick / revert / drop / reword ──
  'ff if fast-forward is possible': 'fast-forward 가능하면 ff',
  'always create a merge commit': '항상 merge 커밋 생성',
  'take changes only, commit yourself': '변경만 가져오고 커밋은 직접',
  'Record origin commit (-x)': '원본 커밋 표기 (-x)',
  'Apply changes without committing (--no-commit)': '커밋하지 않고 변경만 적용 (--no-commit)',
  'Cherry-picked {0}': 'cherry-pick {0} 완료',
  '"{0}"\n\nCreates a new commit that reverts the changes of this commit.':
    '"{0}"\n\n이 커밋의 변경을 되돌리는 새 커밋을 만듭니다.',
  'Reverted {0}': 'revert {0} 완료',
  '"{0}"\n\nRemoves this commit from the current branch history (rebase). Hashes of later commits will change.':
    '"{0}"\n\n이 커밋을 현재 브랜치 히스토리에서 제거합니다(rebase). 이후 커밋들의 해시가 바뀝니다.',
  'Dropped {0}': 'drop {0} 완료',
  'Not the HEAD commit — history is rewritten via rebase, so hashes of later commits will change.':
    'HEAD가 아닌 커밋이므로 rebase로 다시 씁니다 — 이후 커밋들의 해시가 바뀝니다.',
  'Commit message is empty.': '커밋 메시지가 비어 있습니다.',
  'Commit message updated ({0})': '커밋 메시지 수정 완료 ({0})',
  'Rebases branch {0} onto {1}. Commit hashes will change.':
    '{0} 브랜치를 {1} 위로 rebase 합니다. 커밋 해시가 바뀝니다.',
  'Rebased onto {0}': 'rebase onto {0} 완료',

  // ── 브랜치 드래그앤드롭 ──
  'checkout {0}, then merge (HEAD moves)': '{0} 체크아웃 후 merge (HEAD 이동)',
  'Choose what to do with the dropped branch.': '드롭한 브랜치로 수행할 작업을 선택하세요.',
  "Commit hashes of {0} will change and HEAD moves to {0}.":
    '{0}의 커밋 해시가 바뀌고 HEAD가 {0}으로 이동합니다.',
  'Rebased {0} onto {1}': 'rebase {0} onto {1} 완료',
  'Merged {0} into {1}': 'merge {0} into {1} 완료',

  // ── fixup / autosquash ──
  'Target commit ("{0}") not found in the loaded range — try loading more commits.':
    '대상 커밋("{0}")을 로드된 범위에서 찾지 못했습니다 — 커밋을 더 로드해보세요.',
  'fixup! {0}\n\nYou can squash it into the target later with "Squash Fixups… (autosquash)".':
    'fixup! {0}\n\n이후 "Squash Fixups… (autosquash)"로 이 커밋에 합칠 수 있습니다.',
  'Include all changes (-a) — staged changes only when unchecked':
    '모든 변경 포함 (-a) — 해제 시 스테이징된 변경만',
  'Fixup commit created (→ {0})': 'fixup 커밋 생성 완료 (→ {0})',
  'Squashes fixup!/squash! commits into their targets via rebase --autosquash.\nHashes of commits after the target will change — be careful if the range was already pushed.':
    'rebase --autosquash로 fixup!/squash! 커밋들을 대상 커밋에 합칩니다.\n대상 이후 커밋들의 해시가 바뀝니다 — 이미 푸시된 구간이면 주의하세요.',
  'Autosquash done (squashed into {0})': 'autosquash 완료 ({0}에 병합)',

  // ── reset ──
  'keep index & working tree, move HEAD only': '인덱스·워킹트리 보존, HEAD만 이동',
  'reset index, keep working tree (default)': '인덱스 리셋, 워킹트리 보존 (기본값)',
  'discard index & working tree': '인덱스·워킹트리 모두 폐기',
  'All changes in the working tree and index will be permanently lost. This cannot be undone.':
    '워킹트리와 인덱스의 모든 변경사항이 영구히 삭제됩니다. 되돌릴 수 없습니다.',
  'git reset --{0} {1} done — branch label and HEAD (●) moved':
    'git reset --{0} {1} 완료 — 브랜치 라벨과 HEAD(●) 위치가 이동했습니다',
  'Moves branch {0} to point at this commit. Commits above (after) it are removed from the branch.':
    '{0} 브랜치가 이 커밋을 가리키도록 이동합니다. 이 커밋보다 위(이후)의 커밋들이 브랜치에서 제외됩니다.',
  'This commit is already HEAD — reset changes nothing. To undo the last commit, reset from its parent commit below.':
    '이 커밋은 이미 HEAD입니다 — reset해도 아무것도 바뀌지 않습니다. 마지막 커밋을 되돌리려면 바로 아래(부모) 커밋에서 reset 하세요.',
  'The root commit has no parent, so it cannot be undone this way.':
    '루트 커밋은 부모가 없어 이 방식으로 되돌릴 수 없습니다.',
  'Commits from {0} to HEAD are removed from the branch, and {1} will point at the parent commit ({2}). Running this on the HEAD commit equals git reset HEAD~1.':
    '{0}부터 HEAD까지의 커밋이 브랜치에서 제외되고, {1}는 부모 커밋({2})을 가리킵니다. HEAD 커밋에서 실행하면 git reset HEAD~1과 같습니다.',
  'N (commits to go back from HEAD)': 'N (HEAD에서 거슬러 올라갈 커밋 수)',

  // ── drag-to-reset ──
  'Drag down: reset (erase commits)': '아래로 드래그: reset (커밋 지우기)',
  'Reset — undo {0} commits': 'Reset — 커밋 {0}개 되돌리기',
  'These commits are removed from {0}:': '다음 커밋들이 {0} 브랜치에서 제거됩니다:',
  '… and {0} more': '… 외 {0}개',
  '→ new HEAD: {0} {1}': '→ 새 HEAD: {0} {1}',
  '→ new HEAD': '→ 새 HEAD',

  // ── worktree ──
  'Branch (existing or new branch name)': 'Branch (기존 브랜치명 또는 새 브랜치명)',
  '{0}\n\nRemove this worktree? (the branch is not deleted)':
    '{0}\n\n이 worktree를 제거할까요? (브랜치는 삭제되지 않습니다)',
  'Remove failed:\n{0}\n\nForce remove? Changes in its working tree will be lost.':
    '제거 실패:\n{0}\n\n강제로 제거할까요? 워킹트리의 변경사항이 유실됩니다.',
  'Worktree moved: {0}': 'worktree 이동 완료: {0}',
  'Worktree repaired': 'worktree repair 완료',
  'Worktree {0} done': 'worktree {0} 완료',

  // ── checkout ──
  'Unable to Checkout Branch': '브랜치를 체크아웃할 수 없음',
  'Checked out new tracking branch {0}': '새 추적 브랜치 {0} 체크아웃 완료',
  'Local branch {0} is {1} commit(s) ahead and {2} commit(s) behind {3}.':
    '로컬 브랜치 {0}은(는) {3}보다 {1}개 커밋 앞서 있고 {2}개 커밋 뒤처져 있습니다.',
  'Checkout and Pull Remote Branch': '원격 브랜치 체크아웃 및 Pull',
  'Checkout {0}, then pull from {1} with fast-forward only?':
    '{0}을(를) 체크아웃한 뒤 {1}에서 fast-forward 전용으로 pull할까요?',
  'Checkout and Pull': '체크아웃 및 Pull',
  'Checked out {0} and pulled {1}': '{0} 체크아웃 및 {1} pull 완료',
  'Automatic Pull Blocked': '자동 Pull 차단됨',
  'Automatic pull will not run because the local branch is ahead or diverged. Checkout the local branch without pulling?':
    '로컬 브랜치가 앞서 있거나 갈라져 있어 자동 pull을 실행하지 않습니다. pull 없이 로컬 브랜치만 체크아웃할까요?',
  'Checkout Only': '체크아웃만',
  'Checked out {0} without pulling': '{0}을(를) pull 없이 체크아웃했습니다',
  'Checking out commit {0} puts the repository in a detached HEAD state.\nContinue?':
    '{0} 커밋을 체크아웃하면 detached HEAD 상태가 됩니다.\n계속할까요?',

  // ── stash / clean ──
  'Restore the index (staged changes) too (--index)': '인덱스(스테이징)도 복원 (--index)',
  'Stash {0} {1} done': 'stash {0} {1} 완료',
  'Deletes this stash. This cannot be undone.': '이 스태시를 삭제합니다. 되돌릴 수 없습니다.',
  'Dropped stash {0}': 'stash drop {0} 완료',
  'Branch {0} created from stash': 'stash → 브랜치 {0} 생성 완료',
  'Message (optional)': 'Message (선택)',
  'Include untracked files': '추적되지 않은 파일 포함',
  'Stashed working tree changes': 'stash 저장 완료',
  'Also remove directories (-d)': '디렉토리도 삭제 (-d)',
  'Untracked files will be permanently deleted. This cannot be undone.':
    '추적되지 않은 파일이 영구히 삭제됩니다. 되돌릴 수 없습니다.',
  'Clean done': 'clean 완료',
  'Discards all changes in the working tree and index (reset --hard HEAD).\nThis cannot be undone.':
    '워킹트리와 인덱스의 모든 변경사항을 폐기합니다 (reset --hard HEAD).\n되돌릴 수 없습니다.',
  'All changes discarded': '변경사항 폐기 완료',
  '{0}\n\nDeletes all selected stashes. This cannot be undone.':
    '{0}\n\n선택한 스태시를 모두 삭제합니다. 되돌릴 수 없습니다.',
  'Dropped {0} stashes': '스태시 {0}개 삭제 완료',

  // ── 스태시 패널 ──
  'No stashes': '스태시 없음',
  'Select for bulk actions': '일괄 작업용 선택',
  'Orphan stash — its base commit was deleted, so it cannot be shown in the graph. Apply/Drop still work.':
    '고아 스태시 — 베이스 커밋이 삭제되어 그래프에 표시할 수 없습니다. Apply/Drop은 가능합니다.',
  'The base commit is unreachable from any branch/tag (branch deleted or rebased). Not shown in the graph, but Apply/Drop still work.':
    '베이스 커밋이 어떤 브랜치/태그에서도 도달할 수 없습니다 (브랜치 삭제 또는 rebase). 그래프에는 표시되지 않지만 Apply/Drop은 가능합니다.',
  'Drop all checked stashes': '체크한 스태시 일괄 삭제',
  'Stash working tree changes': '워킹트리 변경사항을 스태시로 저장',
  'Refresh stashes': '스태시 새로고침',
  'Close stash panel': '스태시 패널 닫기',
  'Show changed files': '변경 파일 보기',
  'No changed files': '변경 파일 없음',
  'Apply stash': '스태시 적용',
  'Pop stash': '스태시 적용 후 삭제',
  'Compare stash': '스태시 비교',
  'Drop stash': '스태시 삭제',
  'This orphan stash can only be compared one file at a time below.':
    '이 고아 스태시는 아래 파일 목록에서 파일별로만 비교할 수 있습니다.',

  // ── 작성자 통계 패널 ──
  'Author statistics': '작성자 통계',
  'Author Statistics': '작성자 통계',
  'Close author statistics': '작성자 통계 닫기',
  Scope: '범위',
  'Current branch': '현재 브랜치',
  'All refs': '모든 참조',
  Period: '기간',
  'All time': '전체 기간',
  'Last 30 days': '최근 30일',
  'Last 90 days': '최근 90일',
  'Last 365 days': '최근 365일',
  'Counts the complete Git history for this scope, not the loaded graph rows.':
    '로드된 그래프 행이 아닌 선택 범위의 전체 Git 히스토리를 집계합니다.',
  'Loading…': '불러오는 중…',
  'No commits in this range': '선택 범위에 커밋 없음',
  commit: '커밋',
  commits: '커밋',
  '{0} authors · {1} commits': '작성자 {0}명 · 커밋 {1}개',
  Refresh: '새로고침',

  // ── tag ──
  'Message (when annotated)': 'Message (annotated일 때)',
  'Delete tag "{0}"?': '태그 "{0}"을(를) 삭제할까요?',
}
