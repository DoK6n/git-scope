# Changelog

## [Unreleased]

### Added

- **그래프 MVP (M2)**: 커밋 그래프 렌더링 — 레인 배치·브랜치 색상·곡선 엣지, 브랜치/원격/태그 라벨, HEAD 표시, 가상 스크롤, 스크롤 시 증분 로딩
- Uncommitted changes 합성 노드 표시 (HEAD와 연결, 속 빈 원)
- 커밋 상세 패널: 메타데이터 + 변경 파일 목록, 파일 클릭 시 디프 에디터 열기
- 툴바: 리포지토리 선택(멀티 리포), 브랜치 필터, fetch, refresh
- git 계층: child_process 직접 spawn, NUL 구분 `--format` 파싱 (파서 fixture 테스트 포함)
