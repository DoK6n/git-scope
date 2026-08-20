# Changelog (한국어)

English version: [CHANGELOG.md](CHANGELOG.md)

## [Unreleased]

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
