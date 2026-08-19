# Changelog

## [Unreleased]

### Added (M5 패리티 보강)

- 커밋 액션: **Cherry Pick**(-x·--no-commit 옵션, merge는 -m 1), **Revert**, **Drop Commit**(rebase --onto) ⚠️, **Rebase**(커밋/브랜치 대상)
- 원격 액션: **Push Branch**(-u·--force-with-lease), **Pull into current**, **Delete Remote Branch** ⚠️, **Fetch into local branch**, **Push Tag**
- **스태시**: 그래프에 stash 노드 표시(베이스 커밋 연결, 속 빈 원), Apply/Pop(--index 옵션)/Drop ⚠️/Create Branch from Stash/이름·해시 복사
- uncommitted 행 우클릭: **Stash**(untracked 포함 옵션), **Clean Untracked Files** ⚠️, **Discard All Changes** ⚠️, Open Source Control View
- **커밋 비교**: 선택 후 Ctrl/Cmd+클릭 → 두 커밋 사이 변경 파일 목록 + 디프 (비교 대상 행 점선 표시)
- 태그: **View Tag Details**(annotated tagger·메시지), 브랜치 라벨 **Select/Unselect in Branches Dropdown**

### Changed (branding·그래프 시각)

- 표시 이름 GitScope → **Git Scope**
- 오리지널 커밋 그래프 아이콘 추가 — 익스텐션 로고(PNG)와 SCM 타이틀 버튼(SVG light/dark) 동일 글리프. 원본 Git Graph의 아이콘 자산은 클린룸 규칙상 복사하지 않음
- 브랜치 뱃지 색상을 브랜치 이름 해시 기반으로 — 같은 이름이면 항상 같은 색, `origin/x`는 로컬 `x`와 동일 색
- 그래프 레인 이동 곡선을 둥근 엘보(수직→수평→수직)로 변경 — 꺾이는 구간 선 굵기가 일정해짐

### Added (인증)

- `GitScope: Sign in to GitHub` — Cursor/VS Code GitHub 로그인 플로우로 세션 생성, 성공 시 아바타 캐시 초기화 후 재조회
- `GitScope: Set GitHub Token (PAT)` — 토큰을 SecretStorage에 저장 (빈 입력 = 삭제)
- 토큰 우선순위: GitHub 세션 → SecretStorage PAT → `GITHUB_TOKEN` 환경변수

### Changed

- Author 컬럼에 작성자 프로필 사진 표시 — GitHub 리포면 GitHub API로 실제 프로필을 가져와 디스크 캐시(14일 TTL), 아니면 Gravatar(identicon) 폴백, 오프라인 시 숨김. `GitScope: Clear Avatar Cache` 명령 추가

- 커밋 상세를 하단 고정 패널에서 **선택한 행 바로 아래 인라인 확장**으로 변경 (원본 Git Graph의 inline 방식, 스펙 40.1)

### Added

- 원격 브랜치 라벨 앞에 🔌 아이콘 표시 (로컬 브랜치와 한눈에 구분)
- **git reset UI (M4)**: soft/mixed/hard 모드 선택 + 커밋 타겟 또는 HEAD~N 지정, hard 모드 시 취소 불가 경고 (끌 수 없음)
- **검색·필터 glob 지원 (M4)**: 커밋 검색(메시지·작성자·해시)과 브랜치 필터에 즉석 glob 패턴(`*`, `?`, `[...]`) — 일치 하이라이트, 개수 표시, 이전/다음 이동
- **git fetch --prune (M4)**: fetch 버튼 우클릭으로 prune 실행, `gitScope.fetchPruneByDefault` 설정 지원
- **git worktree (M4)**: 목록/추가/제거 패널, 그래프 라벨에 worktree 뱃지(⊕), worktree 브랜치는 checkout 대신 "Open Worktree in New Window", 제거 실패 시 force 재확인
- **기본 액션 (M3)**: 커밋/브랜치/태그 컨텍스트 메뉴 — checkout(브랜치·원격·커밋), 브랜치 생성/삭제/rename, merge(default/no-ff/squash), 태그 생성(lightweight/annotated)/삭제
- 위험 액션 확인 다이얼로그(강제 삭제, detached HEAD 등) + 실패 시 git stderr 그대로 표시, 액션 후 그래프 자동 갱신
- 체크아웃된 브랜치에는 checkout/delete/merge 메뉴를 숨기는 조건부 표시 (스펙 20-actions)
- **그래프 MVP (M2)**: 커밋 그래프 렌더링 — 레인 배치·브랜치 색상·곡선 엣지, 브랜치/원격/태그 라벨, HEAD 표시, 가상 스크롤, 스크롤 시 증분 로딩
- Uncommitted changes 합성 노드 표시 (HEAD와 연결, 속 빈 원)
- 커밋 상세 패널: 메타데이터 + 변경 파일 목록, 파일 클릭 시 디프 에디터 열기
- 툴바: 리포지토리 선택(멀티 리포), 브랜치 필터, fetch, refresh
- git 계층: child_process 직접 spawn, NUL 구분 `--format` 파싱 (파서 fixture 테스트 포함)
