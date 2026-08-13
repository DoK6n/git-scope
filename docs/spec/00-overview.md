# 00. 전체 기능 맵

GitScope 기능 명세의 목차이자 구현 상태 대시보드. 각 영역의 상세 명세는 해당 문서 참조.

> **클린룸**: 모든 명세는 원본 Git Graph의 위키·README·마켓플레이스 페이지·`package.json` contributes 메타데이터, 그리고 블랙박스 관찰에서만 추출한다. 원본 소스 코드는 어떤 경우에도 참조하지 않는다. (규칙: `cleanroom-guard` 스킬)

## 문서 구조

| 문서 | 영역 | 마일스톤 |
|---|---|---|
| [10-graph-view.md](10-graph-view.md) | 그래프 렌더링, 커밋 행, 라벨, 증분 로딩, 툴바 | M2 |
| [20-actions.md](20-actions.md) | 커밋/브랜치/태그/스태시/리모트 컨텍스트 액션 | M3, M5 |
| [30-search-filter.md](30-search-filter.md) | 커밋 검색, 브랜치 필터 (+glob 확장) | M2, M4 |
| [40-views.md](40-views.md) | 커밋 상세 뷰, 비교 뷰, 파일 액션 | M2, M5 |
| [50-settings.md](50-settings.md) | `gitScope.*` 설정 인벤토리 | 전체 |
| [60-new-features.md](60-new-features.md) | 신규 기능: reset UI, worktree, glob 필터, fetch --prune | M4 |

## 구현 상태 (마일스톤 기준)

| 마일스톤 | 내용 | 상태 |
|---|---|---|
| M0 | 프로젝트 셋업 (스킬, CLAUDE.md, 리포 초기화) | ✅ 완료 |
| M1 | 기능 명세 초안 (`docs/spec/`) | ✅ 완료 |
| M2 | 그래프 MVP — 로딩·레인 배치·렌더링·증분 로딩·커밋 상세 | ✅ 완료 |
| M3 | 기본 액션 — checkout / branch / merge / tag + 확인 다이얼로그 | `[todo]` |
| M4 | 신규 기능 — reset → glob 필터 → fetch --prune → worktree | `[todo]` |
| M5 | 패리티 보강 — rebase, cherry-pick, stash, 비교 뷰 | `[todo]` |
| M6 | 첫 배포 (이번 사이클에서는 진행하지 않음) | — |

## 원본과 의도적으로 다른 지점 (`[changed]` 요약)

- **그래프 선 스타일**: rounded 단일 고정 (원본: rounded/angular 선택)
- **브랜치 glob 필터**: 드롭다운에서 즉석 입력 (원본: 설정 파일에 사전 등록)
- **fetch --prune**: fetch 버튼에서 직접 선택 (원본: 설정으로만)
- **git reset**: 모드(soft/mixed/hard) + HEAD~N 타겟 선택 UI (원본: 제한적)
- **git worktree**: 완전 신규 (원본: 미지원)
- **파일 상태 문자 표식(A/M/D/R)**: 항상 표시 (원본: 옵션, 기본 꺼짐)

## 비목표 (구현하지 않음)

- GitLens 수준의 blame/코드렌즈 — 그래프에 집중
- GUI conflict 해결 — VS Code 내장 merge editor에 위임
- 원본 설정의 1:1 재현 — 각 문서에서 `[skip]` 태그된 항목들
