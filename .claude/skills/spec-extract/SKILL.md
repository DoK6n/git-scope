---
name: spec-extract
description: 원본 Git Graph의 위키·블랙박스 관찰에서 기능 명세서를 추출해 docs/spec/에 작성/갱신한다. 클린룸 1단계. 새 기능 영역을 명세화하거나 기존 명세에 빠진 동작을 보충할 때 사용.
---

# Spec Extract

원본 코드를 보지 않고, 허용된 소스에서만 기능 명세를 추출한다. 시작 전에 `cleanroom-guard` 스킬의 허용/금지 목록을 숙지할 것.

## 명세 소스 (이것만 사용)

1. [Git Graph 위키](https://github.com/mhutchie/vscode-git-graph/wiki) — Extension Settings, Getting Started 등
2. 원본 마켓플레이스 페이지·README의 기능 설명
3. 원본 `package.json`의 `contributes` (commands, configuration, menus) — 기능 인벤토리용 사실 데이터
4. 원본 익스텐션을 직접 실행하며 관찰한 동작 (스크린샷 포함 가능)

## 산출물 구조

```
docs/spec/
  00-overview.md      # 전체 기능 맵, 구현 상태 표
  10-graph-view.md    # 그래프 렌더링: 레인 배치, 색상, 라벨, 스크롤/로딩
  20-actions.md       # 커밋/브랜치/태그/스태시/리모트 컨텍스트 액션 전체
  30-search-filter.md # 검색·필터 (신규: glob 패턴 지원 포함)
  40-views.md         # 비교 뷰, 커밋 상세, uncommitted changes 표시
  50-settings.md      # 설정 항목 (gitScope.* 네임스페이스로 재명명)
  60-new-features.md  # 원본에 없는 신규 기능 명세
```

## 명세 작성 규칙

- 각 기능은 **관찰 가능한 동작**으로 기술한다: "커밋 우클릭 → Cherry Pick 선택 → 확인 다이얼로그 → 실행 후 그래프 갱신". 구현 방법은 쓰지 않는다.
- 위키 문장을 그대로 옮기지 않는다. 사실을 추출해 우리 표현으로 재기술.
- 각 항목에 상태 태그: `[todo]` `[wip]` `[done]` `[skip]`(구현 안 함) `[changed]`(원본과 다르게 감)
- 출처를 남긴다: `(출처: 위키 Extension Settings)` / `(출처: 블랙박스 관찰)`
- 원본의 불편한 점을 발견하면 그대로 명세화하지 말고 `60-new-features.md`에 개선안으로 기록

## 필수 신규 기능 (60-new-features.md에 반드시 포함)

1. git reset — `--soft`/`--mixed`/`--hard` 모드 선택, `HEAD~N` 타겟 지정 UI
2. git worktree — 목록/추가/제거, 그래프에 worktree 위치 표시
3. 브랜치명·커밋 검색 필터에 glob 패턴 지원
4. git fetch --prune — fetch 옵션 또는 별도 액션으로 제공
