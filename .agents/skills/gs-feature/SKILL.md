---
name: gs-feature
description: GitScope 기능 구현 워크플로우. 명세 확인 → FSD 배치 설계 → 구현 → 테스트 → 체인지로그 순서로 진행한다. 새 기능을 구현하거나 기존 기능을 수정할 때 사용.
---

# GS Feature

기능 하나를 구현하는 표준 절차. 시작 전 `cleanroom-guard` 규칙이 항상 적용된다.

## 절차

### 1. 명세 확인

- `docs/spec/`에서 해당 기능의 명세를 찾는다
- 명세가 없거나 동작이 불명확하면 **구현하지 말고** 먼저 `spec-extract`로 명세를 보충한다
- 명세 상태를 `[wip]`로 변경

### 2. 설계

- `fsd-architecture` 규칙에 따라 슬라이스 배치를 정한다: 어떤 entity/feature/widget이 생기거나 바뀌는지
- host↔webview 메시지가 필요하면 `shared-types/`에 요청/응답 타입부터 정의
- git 명령이 필요하면: `git help <cmd>`로 옵션·출력 확인 → `src/extension/git/`에 실행 함수 추가. 파싱은 `--format`에 NUL(`%x00`) 구분자 사용을 기본으로

### 3. 구현

- 위험한 액션(reset --hard, force push, branch -D 등)은 반드시 확인 다이얼로그를 거친다
- 액션 실행 후 그래프 데이터 갱신 흐름까지 연결해야 완료
- 에러는 git stderr를 사용자에게 보여준다 — 삼키지 않는다

### 4. 검증

- 유닛 테스트: git 출력 파서는 실제 출력 샘플 fixture로 테스트
- 수동 검증: Extension Development Host(F5)에서 실제 리포로 동작 확인
- 대형 리포(수만 커밋)에서 성능 확인이 필요한 기능이면 명시적으로 확인

### 5. 마무리

- `docs/spec/` 상태를 `[done]`으로 갱신
- 체인지로그는 **두 파일에 모두** 추가한다: `CHANGELOG.md`(영문, 마켓플레이스 노출용)와 `CHANGELOG.ko.md`(한국어). 내용은 동일해야 하며 한쪽만 갱신하지 않는다
- 커밋 메시지: `feat: ...` / `fix: ...` / `perf: ...` 컨벤션

## 우선순위 백로그

MVP(그래프 렌더링 + 데이터 로딩) 이후 필수 신규 기능 4종을 우선 구현한다:

| 순위 | 기능 | 비고 |
|---|---|---|
| 1 | 그래프 뷰 MVP | 커밋 로딩·레인 배치·렌더링 |
| 2 | 기본 액션 | checkout, merge, branch 생성/삭제, tag |
| 3 | **git reset** | soft/mixed/hard + HEAD~N 선택 UI |
| 4 | **검색 glob 필터** | 브랜치명·커밋 메시지 대상 |
| 5 | **git fetch --prune** | fetch 버튼 옵션화 |
| 6 | **git worktree** | 목록/추가/제거 + 그래프 표시 |
| 7 | 나머지 원본 패리티 | rebase, cherry-pick, stash, 비교 뷰 ... |
