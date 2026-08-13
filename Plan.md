# GitScope — Plan

## 한 줄 요약

방치된 Git Graph(mhutchie) 익스텐션을 대체하는, 커밋 그래프 시각화 + 그래프 위에서 git 액션을 실행하는 VS Code 익스텐션을 **클린룸으로 재구현**한다.

## 배경

- 원본 Git Graph는 마지막 릴리즈가 2021년으로 사실상 방치 상태 (마지막 커밋 2021-09-19)
- 원본 라이선스가 파생물의 publish/distribute를 금지 → 코드를 포크해서 배포하는 것은 불가능
- 따라서 **기능·UX 컨셉만 계승**하고 코드는 제로베이스로 새로 작성한다 (기능·아이디어는 저작권 보호 대상이 아님)
- 이름 GitScope는 마켓플레이스 선점 없음 확인 (2026-08-12)

## 진행 방식: 클린룸 3단계

| 단계 | 내용 | 산출물 |
|---|---|---|
| 1. 스펙 추출 | 원본 위키·블랙박스 관찰·`contributes` 메타데이터에서 기능 명세 작성. **원본 소스는 열지 않는다** | `docs/spec/` |
| 2. 원본 격리 | 명세 완성 후 원본 클론을 작업 경로에서 제외. 막히면 git 공식 문서·VS Code API 문서·실행 중인 원본의 동작만 참조 | — |
| 3. 제로베이스 구현 | 명세만 보고 새로 작성 | `src/` |

상세 규칙: `.claude/skills/cleanroom-guard/SKILL.md`

## 기술 스택

| 영역 | 선택 | 이유 |
|---|---|---|
| 언어 | TypeScript (strict) | |
| Webview UI | SolidJS | 반응성 성능 + 작은 런타임. 그래프 자체는 커스텀 SVG/Canvas 렌더링 |
| Webview 번들 | Vite + vite-plugin-solid | SolidJS JSX 컴파일 |
| Extension host 번들 | esbuild | VS Code 익스텐션 표준 |
| Git 계층 | child_process 직접 spawn | 의존성 제로, `--format` 커스텀 파싱으로 성능·출력 완전 제어 |
| 아키텍처 | FSD (webview 한정) | `.claude/skills/fsd-architecture/SKILL.md` 참조 |

## 기능 범위

### A. 원본 패리티 (핵심만 우선)

- 커밋 그래프 렌더링: 브랜치 레인·색상, 브랜치/태그 라벨, HEAD 표시, 증분 로딩
- 컨텍스트 액션: checkout, branch 생성/삭제/rename, merge, rebase, cherry-pick, revert, tag, stash, push/pull/fetch
- 커밋 상세 뷰(변경 파일 목록·디프 열기), 커밋 간 비교
- uncommitted changes 표시
- 검색/필터, 멀티 리포 지원, 설정(`gitScope.*`)

### B. 필수 신규 기능 (원본에 없거나 부족)

1. **git reset** — `--soft` / `--mixed` / `--hard` 모드 선택 + `HEAD~N` 타겟 지정 UI
2. **git worktree** — 목록/추가/제거, 그래프에 worktree 브랜치 표시
3. **glob 패턴 검색 필터** — 브랜치명·커밋 메시지에 glob 적용
4. **git fetch --prune** — 삭제된 원격 브랜치 참조 정리

### C. 개선 목표 (원본 대비)

- 대형 리포(수만 커밋) 성능: 스트리밍 파싱, 가상 스크롤, 증분 갱신
- 현대적 코드베이스: strict TS, 테스트(파서는 fixture 기반), FSD로 기능 단위 격리

### 비목표 (당분간 안 함)

- GitLens 수준의 blame/코드렌즈 기능 — 그래프에 집중
- GUI 기반 conflict 해결 — VS Code 내장 merge editor에 위임
- 원본의 모든 설정 항목 1:1 재현 — 쓰이는 것만

## 마일스톤

| | 목표 | 완료 기준 |
|---|---|---|
| M0 | 프로젝트 셋업 | ✅ 스킬·CLAUDE.md·리포 초기화 (2026-08-13) |
| M1 | 기능 명세 | `docs/spec/` 초안 완성, 원본 클론 격리 |
| M2 | 그래프 MVP | 실제 리포의 커밋 그래프가 webview에 렌더링, 증분 로딩 동작 |
| M3 | 기본 액션 | checkout/merge/branch/tag + 확인 다이얼로그 + 그래프 갱신 |
| M4 | 필수 신규 기능 | reset → glob 필터 → fetch --prune → worktree 순 구현 |
| M5 | 패리티 보강 | rebase, cherry-pick, stash, 비교 뷰, 커밋 상세 |
| M6 | 첫 배포 | vsce 패키징, 마켓플레이스 publish (`gs-release` 절차) |

## 작업 규칙

- 기능 구현은 `gs-feature` 워크플로우를 따른다: 명세 확인 → FSD 배치 설계 → 구현 → 테스트 → 체인지로그
- 위험 액션(reset --hard 등)은 반드시 확인 다이얼로그
- 모든 커밋은 conventional commits (`feat:` `fix:` `perf:` `chore:`)
