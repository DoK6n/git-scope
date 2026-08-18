# Changelog

## [Unreleased]

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
