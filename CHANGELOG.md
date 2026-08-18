# Changelog

## [Unreleased]

### Added

- **기본 액션 (M3)**: 커밋/브랜치/태그 컨텍스트 메뉴 — checkout(브랜치·원격·커밋), 브랜치 생성/삭제/rename, merge(default/no-ff/squash), 태그 생성(lightweight/annotated)/삭제
- 위험 액션 확인 다이얼로그(강제 삭제, detached HEAD 등) + 실패 시 git stderr 그대로 표시, 액션 후 그래프 자동 갱신
- 체크아웃된 브랜치에는 checkout/delete/merge 메뉴를 숨기는 조건부 표시 (스펙 20-actions)
- **그래프 MVP (M2)**: 커밋 그래프 렌더링 — 레인 배치·브랜치 색상·곡선 엣지, 브랜치/원격/태그 라벨, HEAD 표시, 가상 스크롤, 스크롤 시 증분 로딩
- Uncommitted changes 합성 노드 표시 (HEAD와 연결, 속 빈 원)
- 커밋 상세 패널: 메타데이터 + 변경 파일 목록, 파일 클릭 시 디프 에디터 열기
- 툴바: 리포지토리 선택(멀티 리포), 브랜치 필터, fetch, refresh
- git 계층: child_process 직접 spawn, NUL 구분 `--format` 파싱 (파서 fixture 테스트 포함)
