# Changelog (한국어)

English version: [CHANGELOG.md](CHANGELOG.md)

## [Unreleased]

### Fixed

- **linked worktree·서브모듈** 안에서 머지 계열 액션을 하면 소스 제어의 커밋 메시지 칸이 계속 비어 있던 문제를 고쳤습니다. VS Code 내장 git은 경로를 `<root>/.git/MERGE_MSG`로 조립하는데, 이 저장소들의 `.git`은 디렉토리가 아니라 실제 git 디렉토리 경로가 적힌 **파일**이라 읽기가 `ENOTDIR`로 실패하고, 그것이 조용히 "메시지 없음"으로 처리됩니다. 이제 Git Scope가 경로를 `rev-parse --git-path`로 해석하고 해당 저장소에서는 기본 메시지를 소스 제어 입력칸에 직접 넣습니다 — `merge`, `cherry-pick`, `revert`, `pull` 모두 터미널에서 `git commit` 했을 때와 같은 기본 메시지가 뜹니다. 일반 저장소는 내장 git이 정상적으로 읽으므로 건드리지 않습니다. 이미 작성 중인 메시지는 덮어쓰지 않고, 기본 메시지를 못 채워도 액션 결과 자체에는 영향이 없습니다.

## [0.6.3] - 2026-09-03

### Fixed

- 그래프에서 **squash 머지**를 한 뒤 소스 제어의 커밋 메시지 칸이 비어 있던 문제를 고쳤습니다. git은 일반 머지의 기본 메시지를 `MERGE_MSG`에 쓰지만 squash 머지는 `SQUASH_MSG`에 쓰는데, IDE의 소스 제어 입력칸은 `MERGE_MSG`만 읽습니다(충돌이 나면 충돌 파일 주석만 들어갑니다). 이제 squash 머지 후 터미널에서 `git commit` 했을 때와 같은 기본 메시지가 입력칸에 뜹니다. 충돌 파일 주석은 그대로 유지되고, 이미 작성 중인 메시지가 있으면 덮어쓰지 않습니다.

## [0.6.2] - 2026-09-03

### Fixed

- 빌드 산출물·캐시 디렉토리(`.next`, `dist`, turbopack 캐시 등)에 파일을 계속 쓰는 도구가 돌아도 감시 비용이 붙지 않습니다: gitignore 판정을 **디렉토리 단위로 캐시**하므로, 한 번 무시 대상으로 판정된 디렉토리 아래에서 쏟아지는 이벤트는 git 프로세스 없이 버려집니다. 개발 서버를 켜둔 채 작업할 때 백그라운드 git 호출이 사라집니다.
- 아무 작업도 하지 않는데 백그라운드에서 git 명령이 2초마다 무한히 실행되던 문제를 고쳤습니다. 워킹트리 감시는 그대로 두되(Discard Changes·터미널 작업 반영에 필요), 이벤트 1건의 처리 비용을 없앴습니다: 변경 이벤트가 오면 먼저 **파일 mtime으로 실제 변경 여부를 로컬 판정**하고(git 프로세스 0개), 통과한 경우에만 `git status` 서명을 직전 값과 비교해 **실제로 달라졌을 때만** 그래프를 갱신합니다. 파일이 많은 저장소에서 변경 없이 들어오는 워처 이벤트는 git을 한 번도 띄우지 않고 걸러집니다. 이전에는 배치마다 `git check-ignore`를 띄우고 전체 그래프를 재조회해 무한 루프가 됐습니다.
- 이미 수정된 파일을 반복 저장하는 등 `git status` 결과가 그대로인 변경은 더 이상 그래프를 다시 그리지 않습니다.
- 앱에서 실행한 액션 하나에 그래프가 두 번 그려지던 문제를 고쳤습니다. 스태시 저장처럼 `.git`과 워킹트리를 함께 바꾸는 액션은 액션 후 뮤트 시간이 지난 뒤 감시 이벤트가 살아남아 2초 뒤 한 번 더 갱신됐습니다. 이제 모든 감시 경로가 하나의 게이트를 지나고, 액션 직후의 상태(refs·HEAD·index·status)를 서명으로 남겨 그 액션이 유발한 이벤트를 걸러냅니다.
- 창이나 패널이 다시 활성화될 때마다 그래프를 통째로 재조회하던 동작을 없앴습니다: refs 목록·HEAD·index·`status`를 직전 상태와 비교해 **실제로 달라졌을 때만** 갱신합니다(git 2회). 창을 오갈 때마다 git이 7~8개씩 뜨지 않습니다.
- 스태시 패널을 열 때 스태시 개수만큼 `git for-each-ref --contains`를 실행하던 것을 `git rev-list --no-walk` 한 번으로 대체했습니다. 스태시 34개 기준 30개 프로세스·0.86초 → 1개 프로세스·0.04초입니다(고아 스태시 판정 결과는 동일).
- 그래프 패널이 보이지 않는 동안에는 감시 처리를 아예 하지 않습니다 — 패널이 다시 보이거나 창이 포커스를 되찾을 때 한 번 갱신하므로, 숨겨진 패널 때문에 백그라운드에서 git이 도는 일이 없습니다.

## [0.6.1] - 2026-08-28

### Changed

- Marketplace의 텔레메트리 안내를 명확히 했습니다: 작업 종류는 사용자가 입력한 브랜치명이나 작업명이 아니라 `checkoutBranch`, `merge`, `reset` 같은 Git Scope의 고정된 내부 기능 식별자입니다. 실제 브랜치명·태그명, 커밋 해시·메시지, 파일·저장소 경로, 원격명·URL, 스태시 메시지, 오류 텍스트를 비롯한 작업 파라미터와 저장소 데이터는 수집하지 않습니다.

## [0.6.0] - 2026-08-28

### Added

- **Drag-to-reset**: HEAD 커밋의 그래프 점을 아래로 드래그하면 지나간 커밋들이 "지워지는" 미리보기 표시 — 지워질 행은 흐려지며 `reset` 칩이 붙고 새 HEAD가 될 커밋이 강조되며, 머지 커밋을 지우면 도달 불가가 되는 사이드 브랜치 커밋도 함께 흐려집니다(다른 ref가 보호하는 커밋은 남습니다). 마우스를 놓으면 제거될 커밋 목록·새 HEAD·soft/mixed/hard 모드 선택이 담긴 확인 다이얼로그가 열리고, `Esc`로 드래그를 취소할 수 있습니다. 뷰포트 가장자리 근처에서는 자동 스크롤되며 바닥에서는 추가 커밋을 로드합니다.
- `@vscode/extension-telemetry` 기반 익명 사용 텔레메트리 추가: VS Code의 텔레메트리 설정을 존중하면서 확장 활성화, 그래프 열기, 저장소 변경 작업의 종류·성공 여부·소요 시간만 기록합니다. 작업 종류는 사용자가 입력한 브랜치명이나 작업명이 아니라 `checkoutBranch`, `merge`, `reset` 같은 Git Scope의 고정된 내부 기능 식별자입니다. 실제 브랜치명·태그명, 커밋 해시·메시지, 파일·저장소 경로, 원격명·URL, 스태시 메시지, 오류 텍스트를 비롯한 작업 파라미터와 저장소 데이터는 수집하지 않습니다.

### Fixed

- 워킹트리 감시가 gitignore 대상 경로(빌드 산출물, 생성 코드, 캐시)에 더 이상 반응하지 않습니다: 변경 이벤트를 모아 `git check-ignore`로 일괄 판정하므로, 무시 대상 파일을 계속 쓰는 도구(코드젠, 번들러 watch 등)가 그래프 재조회 무한 루프를 일으키지 않습니다. 안전장치로 자동 갱신 자체도 2초에 1회로 제한됩니다.

## [0.5.2] - 2026-08-26

### Changed

- README의 개별 스크린샷·데모를 제거하고, 페이지 최상단의 최신 1.5배속 `preview.gif` 하나로 교체.

## [0.5.1] - 2026-08-26

### Fixed

- IDE Source Control의 **Discard Changes**처럼 working tree 파일만 바뀌는 작업도 수동 새로고침 없이 uncommitted 행에 자동 반영.

## [0.5.0] - 2026-08-26

### Added

- 브랜치 드롭다운 헤더에 **Show Remote Branches** 토글 추가 — 끄면 원격 ref를 그래프·뱃지·드롭다운에서 제외하고, 필터에 남아 있던 원격 브랜치 선택도 함께 해제.
- Fetch 옆에 전용 **Fetch (prune)** 툴바 버튼(가위 아이콘) 추가, 툴팁으로 `git fetch --all --prune` 설명 표시.
- 커밋 상세 파일 행에 Git Graph처럼 hover 액션 추가: 절대 경로 복사, 에디터로 파일 열기(삭제된 파일은 열기 숨김).
- `gitScope.language` 설정 추가 (`en`/`ko`, 기본 `en`): 툴팁·다이얼로그·알림 등 UI 문구가 기본 영어이며, 설정하면 한국어로 표시. 뷰를 다시 열지 않아도 즉시 반영.
- `origin/HEAD`를 가리키는 커밋에 뱃지로 표시 (우클릭은 Copy만 제공, 브랜치 필터·브랜치 액션 대상에서는 제외).
- 체크아웃 실패 시(예: 다른 worktree에 이미 체크아웃된 브랜치) 토스트 알림 대신 git 에러 메시지를 담은 **Error: Unable to Checkout Branch** 다이얼로그 표시.
- `Cmd/Ctrl+F`로 여는 IDE 스타일 커밋 검색 위젯 추가 — 현재/전체 결과 수, 결과 없음 표시, 대소문자·단어 단위·정규식 옵션, 검색 기록, 키보드 이동, `Esc` 닫기 및 슬라이드 애니메이션 지원.

### Fixed

- 브랜치 필터가 이제 **선택한 브랜치만** 표시: `git log`에 `HEAD`가 항상 전달되어 체크아웃된 브랜치 이력이 모든 필터 뷰에 섞여 필터가 동작하지 않는 것처럼 보이던 버그 수정.
- 외부 git 변경(IDE Source Control, 터미널, 다른 도구)이 linked worktree·서브모듈형 체크아웃에서도 감지됨 — 기존 `.git` 워처가 디렉토리가 아닌 `.git` *파일*을 감시해 이벤트가 전혀 오지 않던 문제를 실제 `gitdir`·`commondir`을 해석해 감시하도록 수정.
- 액션 한 번에 그래프가 여러 번 리로드되던 문제 수정 — 확장 자신의 요청이 남긴 `.git` 변경(fetch의 `FETCH_HEAD` 기록, `git status`의 index 재작성 등)을 워처가 다시 감지해 액션 자체 갱신 위에 추가 갱신을 얹던 버그.

### Changed

- 브랜치 드롭다운 리디자인: 현재 상태를 표시하는 select형 트리거, "Filter Branches…" glob 입력, Show Remote Branches 토글 + Tree/List 전환 헤더, 클릭 즉시 적용되는 체크마크 행 — 두 뷰 모두 Show All ─ 로컬 브랜치 ─ 원격별 그룹(마지막) 순으로 divider로 구분. Tree 뷰는 폴더 그룹핑을 유지하며(접기 화살표 확대, 원격 그룹 내부는 접두 생략) 전체가 동일한 ✓ 체크마크를 쓰고 일부 선택 폴더는 `–`로 표시, Show Remote Branches 토글도 ✓ 스타일 통일.
- 항상 표시되던 가운데 검색창을 제거하고, 커밋 검색을 우측 상단 오버레이로 변경.
- 일부 webview 환경에서 네이티브 `title` 툴팁이 표시되지 않아, 툴바 버튼과 파일 행 액션은 커스텀 CSS 툴팁(짧은 hover 지연 후 표시)을 사용.
- 체크아웃된 브랜치 뱃지는 왼쪽 바깥에 라인 색상의 ○ 마커를 표시하고 브랜치명을 굵게 표시.
- Fetch·Refresh 툴바 버튼을 아이콘 버튼으로 교체(클라우드 다운로드 / 원형 화살표), 로딩 중에는 새로고침 아이콘이 회전.
- 스태시 패널의 일괄 선택 체크박스를 브랜치 드롭다운과 같은 체크마크 스타일로 변경.
- 우측 툴바 액션 버튼을 배경 없는 IDE 스타일로 바꾸고 브랜치 필터 화살표를 확대.
- 브랜치·태그 뱃지의 아이콘 색상 영역이 왼쪽 경계까지 채워지도록 변경하고, 파일 열기 액션은 VS Code `go-to-file` 아이콘 사용.
- 중복이던 툴바의 현재 브랜치 텍스트(`● 브랜치`)를 제거하고 그래프의 HEAD 뱃지로만 현재 브랜치 표시.

## [0.4.3] - 2026-08-24

### Changed

- README 소개 영역에 커밋 그래프 이미지와 그래프 라인 하이라이팅·브랜치 드래그앤드롭 merge/rebase GIF 데모 추가.

## [0.4.2] - 2026-08-21

### Fixed

- 명령을 실행하기 전에도 상태 표시줄 버튼이 보이도록 IDE 시작 완료 후 Git Scope를 자동 활성화.

## [0.4.1] - 2026-08-21

### Fixed

- 확장 브랜드와 일치하도록 상태 표시줄 버튼 이름을 **Git Graph**에서 **Git Scope**로 변경.

## [0.4.0] - 2026-08-21

### Added

- 상태 표시줄 왼쪽 영역에 그래프 뷰를 여는 **Git Graph** 버튼 추가. `gitScope.showStatusBarItem` 설정으로 숨길 수 있음.

## [0.3.4] - 2026-08-21

### Changed

- Marketplace 표시 이름을 **Git Scope: View Git Graph**, 확장 식별자를 `dok6n.git-scope-view-git-graph`로 최종 확정.

## [0.3.3] - 2026-08-21

### Changed

- Marketplace 표시 이름을 **Git Scope Pro**, 확장 식별자를 `dok6n.git-scope-pro`로 최종 확정.

## [0.3.2] - 2026-08-21

### Changed

- 전역 고유 이름을 사용하도록 Marketplace 표시 이름을 **DoK6n Git Scope**로 변경.

## [0.3.1] - 2026-08-21

### Changed

- 전역 고유 이름을 사용하도록 Marketplace 확장 식별자를 `dok6n-git-scope`로 변경. 표시 이름은 **Git Scope**로 유지.

## [0.3.0] - 2026-08-21

### Added

- **스태시 목록 패널** — 툴바 "Stashes" 버튼으로 전체 스태시 목록(셀렉터·제목·날짜) 표시. 행 클릭 시 그래프에서 선택, 우클릭으로 Apply/Pop/Create Branch/Drop, 하단 버튼으로 워킹트리 변경 스태시 저장
- 패널에서 스태시 클릭 시 **그래프가 해당 행으로 스크롤**(검색 이동처럼 화면 중앙 정렬) — 로드 범위 밖이면 **찾을 때까지 커밋 자동 추가 로드** 후 이동. 행 **체크박스로 일괄 삭제** 지원 — "Drop Selected (N)"이 인덱스 큰 것부터 삭제해 나머지 셀렉터가 밀리지 않음
- **fixup/autosquash GUI** — `fixup!`/`squash!`/`amend!` 커밋에 뱃지 칩 표시(클릭 시 대상 커밋으로 이동). 커밋 우클릭 **Create Fixup Commit**으로 현재 작업분을 fixup 커밋으로 저장(`commit --fixup`, `-a` 선택), fixup 커밋 우클릭 **Squash Fixups into Target** ⚠️으로 비대화식 `rebase -i --autosquash` 실행 (루트 대상은 `--root` 폴백)
- 베이스 커밋이 어떤 브랜치/태그에서도 도달 불가한 스태시(브랜치 삭제·rebase 후)는 패널에 **"orphan" 칩** 표시 — 그래프에는 나타날 수 없지만 Apply/Drop은 정상 동작
- 스태시 행에 **`stash@{N}` 라벨 뱃지** 표시 (상자 글리프, 클린룸 규칙에 따라 자체 제작 SVG). 색상은 브랜치 뱃지와 동일하게 커밋의 그래프 라인 색을 따름. 뱃지 우클릭 시 동일한 스태시 메뉴

## [0.2.0] - 2026-08-20

### Added

- 커밋 우클릭 메뉴에 **Edit Commit Message…** — HEAD에서 도달 가능한 임의 커밋의 메시지 수정(reword). 기존 메시지 전문이 채워진 textarea에서 편집하며, 메시지만 바뀌고 내용(tree)·author 정보는 보존. HEAD 커밋은 `commit --amend --only`, 조상 커밋은 `commit-tree` + `rebase --rebase-merges --onto`로 재작성 ⚠️ (이후 커밋 해시 변경 — 경고 표시)
- **Git Scope Output 채널** — 익스텐션이 실행하는 모든 git 명령을 Output 패널에 기록 (명령줄·exit code·소요 시간·리포 경로, 실패 시 stderr)
- Fetch 버튼을 **스플릿 버튼**으로 개편 — ▾ 캐럿 클릭으로 fetch 옵션 메뉴(**Fetch (prune)** — 원격에서 삭제된 브랜치 참조 정리)를 바로 열 수 있음 (기존에는 우클릭으로만 접근 가능)
- Branches 필터 드롭다운에 **Tree | List** 뷰 토글 추가 — 트리는 브랜치명을 `/` 세그먼트로 그룹핑(단일 하위 폴더 체인 압축), 폴더 접기/펼치기, 폴더 체크박스로 하위 브랜치 일괄 선택/해제(부분 선택 시 indeterminate)
- **브랜치 뱃지 드래그앤드롭** — 브랜치 뱃지(로컬·원격)를 로컬 브랜치 뱃지에 드롭하면 **Merge into**(필요 시 대상 브랜치 체크아웃 후 merge) 또는 **Rebase onto** ⚠️ 선택 실행 (rebase는 로컬 source만, 원격 source는 merge만 제공). 드래그 중 드롭 가능한 뱃지에 점선 아웃라인 표시

### Fixed

- 다이얼로그 경고 박스 글자가 일부 테마(경고 배경과 `editorWarning.foreground`가 모두 주황 계열)에서 안 보이던 문제 수정 — `inputValidation.warningBackground`와 짝이 맞는 foreground(없으면 일반 foreground 폴백) + 경고 테두리 적용
- danger 버튼 글자색도 `inputValidation.errorBackground`와 짝이 맞는 foreground로 수정. 경고 문구가 표시된다는 이유만으로 확인 버튼이 붉게 바뀌던 동작 제거(경고 박스가 그 역할) — 명시적으로 위험한 다이얼로그만 붉은 버튼 유지

### Changed

- 아바타 스택 겹침 순서 변경: 커밋 **author가 맨 앞**, co-author(AI 포함) 아바타는 그 뒤에 깔리도록 수정
- AI 공동 작성자 번들 아이콘에 **Cursor** 추가 (`Co-authored-by: Cursor <…@cursor.com>`) — Claude·Codex와 동일 방식

### Added (UI·폴리시)

- 테이블 헤더(`Graph | Commit | Author | Date | Hash`) + 경계 드래그로 컬럼 폭 조절, 경계 더블클릭 시 보이는 콘텐츠에 자동 맞춤 (Graph는 레인 수 기준으로 리셋)
- 변경 파일을 **파일 트리**(기본) 또는 리스트로 표시 — IDE의 **파일 아이콘 테마**(SVG·폰트 글리프 테마 모두) 적용, 파일별 `(+추가 | -삭제)` 라인 수 표시
- `Co-authored-by` 트레일러의 **공동 작성자 아바타** — GitHub 스타일 겹침 스택, hover 시 슬라이드 펼침, AI 공동 작성자(Claude, Codex) 전용 아이콘 번들
- 그래프 **라인 강조** — hover/클릭, 상세뷰가 열린 커밋의 라인은 자동 강조
- 브랜치 뱃지 더블클릭 → `git switch` (원격 뱃지는 추적 브랜치 생성)
- 브랜치 뱃지 우클릭에 "Create Branch from Here…" 추가
- worktree 패널 개편: ✓ 현재 / ✨ 메인 / 🔒 잠금 표시, hover 열기 액션(새 창/현재 창), 우클릭 메뉴(Move/Repair/Remove/Lock)
- 자동 갱신: `.git` 워처가 앱 내 액션·터미널 작업 모두 그래프에 즉시 반영
- 알림을 IDE 네이티브 알림 영역으로 전환 (성공·git stderr 에러)

### Added (M5 패리티 보강)

- 커밋 액션: **Cherry Pick**(-x·--no-commit 옵션, merge는 -m 1), **Revert**, **Drop Commit**(rebase --onto) ⚠️, **Rebase**(커밋/브랜치 대상)
- 원격 액션: **Push Branch**(-u·--force-with-lease), **Pull into current**, **Delete Remote Branch** ⚠️, **Fetch into local branch**, **Push Tag**
- **스태시**: 그래프에 stash 노드 표시(베이스 커밋 연결, 속 빈 원), Apply/Pop(--index 옵션)/Drop ⚠️/Create Branch from Stash/이름·해시 복사
- uncommitted 행 우클릭: **Stash**(untracked 포함 옵션), **Clean Untracked Files** ⚠️, **Discard All Changes** ⚠️, Open Source Control View
- **커밋 비교**: 선택 후 Ctrl/Cmd+클릭 → 두 커밋 사이 변경 파일 목록 + 디프 (비교 대상 행 점선 표시)
- 태그: **View Tag Details**(annotated tagger·메시지), 브랜치 라벨 **Select/Unselect in Branches Dropdown**

### Changed (브랜딩·그래프 시각)

- 표시 이름 GitScope → **Git Scope**
- 오리지널 커밋 그래프 아이콘 — 익스텐션 로고(PNG)와 SCM 타이틀 버튼(SVG light/dark) 동일 글리프. 원본 Git Graph의 아이콘 자산은 클린룸 규칙상 복사하지 않음
- 브랜치 뱃지 디자인 개편: 어두운 배경 + 브랜치색 테두리 + 색상 아이콘 칩, 뱃지 색은 커밋이 속한 **그래프 라인 색**과 일치, 로컬·원격 통합 뱃지(`branch | origin`)와 영역별 hover
- 레인 이동 곡선의 선 굵기 일정화 (곡선 내부가 채워지던 CSS fill 버그 수정)
- 그래프 컬럼 너비가 최대 레인 수를 따라 가변 — 추가 로드 시 자동 갱신

### Added (인증)

- `Git Scope: Sign in to GitHub` — 에디터의 GitHub 로그인 플로우 사용, 성공 시 아바타 캐시 초기화
- `Git Scope: Set GitHub Token (PAT)` — 토큰을 SecretStorage에 저장 (빈 입력 = 삭제)
- 토큰 우선순위: GitHub 세션 → SecretStorage PAT → `GITHUB_TOKEN` 환경변수

### Changed

- Author 컬럼에 프로필 사진 — GitHub 리포면 GitHub API로 조회해 디스크 캐시(14일), 아니면 Gravatar(identicon) 폴백, 오프라인 시 숨김. `Git Scope: Clear Avatar Cache` 명령 추가
- 커밋 상세를 하단 고정 패널에서 **선택한 행 바로 아래 인라인 확장**으로 변경, 그래프 컬럼을 가리지 않도록 Commit 컬럼부터 시작

### Added

- **git reset UI**: soft/mixed/hard + 커밋 타겟 또는 `HEAD~N`, hard 모드 취소 불가 경고(끌 수 없음), "Undo this Commit & above"(부모로 reset) 포함
- **검색·필터 glob 지원**: 커밋 검색(메시지·작성자·해시)과 브랜치 필터에 즉석 glob 패턴(`*`, `?`, `[...]`) — 일치 하이라이트, 개수, 이전/다음 이동
- **git fetch --prune**: fetch 버튼 우클릭, `gitScope.fetchPruneByDefault` 설정
- **git worktree**: 목록/추가/제거 패널, 그래프 라벨 worktree 뱃지, checkout 대신 "Open Worktree in New Window", 제거 실패 시 force 재확인
- **기본 액션**: 커밋/브랜치/태그 컨텍스트 메뉴 — checkout(브랜치·원격·커밋), 브랜치 생성/삭제/rename, merge(default/no-ff/squash), 태그 생성(lightweight/annotated)/삭제
- 위험 액션 확인 다이얼로그 + 실패 시 git stderr 그대로 표시, 액션 후 그래프 자동 갱신
- 체크아웃된 브랜치에는 checkout/delete/merge 메뉴 숨김
- **그래프 MVP**: 커밋 그래프 렌더링 — 레인 배치·브랜치 색상·곡선 엣지, 브랜치/원격/태그 라벨, HEAD 표시, 가상 스크롤, 증분 로딩
- Uncommitted changes 합성 노드 (HEAD 연결, 속 빈 원)
- 커밋 상세: 메타데이터 + 변경 파일, 파일 클릭 시 디프 열기
- 툴바: 리포지토리 선택(멀티 리포), 브랜치 필터, fetch, refresh
- git 계층: child_process 직접 spawn, NUL 구분 `--format` 파싱 (파서 fixture 테스트)
