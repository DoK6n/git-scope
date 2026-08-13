# GitScope

Git Graph(mhutchie)의 컨셉을 클린룸으로 재구현하는 VS Code 익스텐션. 커밋 그래프 시각화 + 그래프에서 직접 git 액션 실행.

## ⚠️ 클린룸 규칙 (최우선)

원본 `../vscode-git-graph`의 **소스 코드를 절대 읽지 않는다.** 이 프로젝트의 모든 코드는 원본에서 유래하지 않아야 마켓플레이스 배포가 합법이다. 구현 중 참조가 필요하면 반드시 `cleanroom-guard` 스킬의 허용/금지 목록을 따른다.

## 기술 스택 (확정)

| 영역 | 선택 | 비고 |
|---|---|---|
| 언어 | TypeScript (strict) | |
| Webview UI | SolidJS | 그래프 자체는 커스텀 SVG/Canvas 렌더링 |
| Webview 번들 | Vite + vite-plugin-solid | SolidJS JSX 컴파일 필요 |
| Extension host 번들 | esbuild | |
| Git 계층 | child_process 직접 spawn | 라이브러리 없이 `--format` 커스텀 파싱, 성능 완전 제어 |
| 아키텍처 | FSD (webview) | `fsd-architecture` 스킬 참조 |

## 필수 신규 기능 (원본에 없거나 부족한 것)

1. **git reset** — `--soft` / `--mixed` / `--hard` 모드 선택 + `HEAD~N` 타겟 지정
2. **git worktree** — 목록/추가/제거, 그래프에서 worktree 브랜치 표시
3. **glob 패턴 검색 필터** — 브랜치명·커밋 메시지에 glob 패턴 적용
4. **git fetch --prune** — 원격에서 삭제된 브랜치 참조 정리

## 스킬

- `spec-extract` — 원본 위키·블랙박스 관찰에서 기능 명세 추출 (클린룸 1단계)
- `cleanroom-guard` — 클린룸 규율: 금지/허용 참조 목록
- `gs-feature` — 기능 구현 워크플로우 (명세 → FSD 배치 → 구현 → 테스트 → 체인지로그)
- `gs-release` — 패키징·버전·배포 절차
- `fsd-architecture` — FSD 레이어 규칙 및 디렉토리 구조

## 문서

- 기능 명세: `docs/spec/` (spec-extract 스킬이 생성/갱신)
