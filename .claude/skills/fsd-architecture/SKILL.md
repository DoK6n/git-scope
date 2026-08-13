---
name: fsd-architecture
description: GitScope의 FSD(Feature-Sliced Design) 아키텍처 규칙. 새 파일/모듈의 위치를 정하거나, 레이어 간 의존 방향을 검토하거나, 구조 리뷰가 필요할 때 사용.
---

# FSD Architecture

GitScope는 webview(SolidJS)에 FSD를 적용하고, extension host(Node)는 단순 레이어드로 간다.

## 전체 구조

```
src/
  extension/              # Extension host (Node) — FSD 아님
    commands/             # VS Code 커맨드 등록
    git/                  # git spawn 실행기, --format 파서, 타입
    bridge/               # webview 메시지 프로토콜 (host 쪽)
    config/               # gitScope.* 설정 읽기
  webview/                # SolidJS 앱 — FSD 적용
    app/                  # 엔트리, 전역 프로바이더, 테마
    widgets/              # graph-view, toolbar, commit-details, dialogs
    features/             # 사용자 액션 단위: checkout, merge, rebase,
                          #   reset, cherry-pick, worktree-manage,
                          #   search-filter, fetch, stash ...
    entities/             # 도메인 모델: commit, branch, tag, remote,
                          #   stash, worktree (+ 각각의 표시 컴포넌트)
    shared/               # ui(공용 컴포넌트), lib(유틸), api(bridge 클라이언트)
  shared-types/           # host↔webview 공유 메시지/도메인 타입 (양쪽에서 import)
```

## 레이어 규칙 (위 → 아래 방향으로만 import)

```
app → widgets → features → entities → shared
```

- **상향 import 금지**: entities가 features를, features가 widgets를 import하면 위반
- **동일 레이어 슬라이스 간 import 금지**: `features/merge`가 `features/checkout`을 import하지 않는다. 조합이 필요하면 상위 레이어(widgets)에서 한다
- **Public API**: 각 슬라이스는 `index.ts`로만 노출. 외부에서 슬라이스 내부 경로 deep import 금지
- **세그먼트**: 슬라이스 내부는 `ui/` `model/`(상태·로직) `lib/` `api/`로 구분. 다 필요한 건 아니고 있는 것만

## 배치 판단 기준

| 이건 어디에? | 답 |
|---|---|
| "커밋 하나"의 타입과 뱃지 컴포넌트 | `entities/commit` |
| reset 다이얼로그 + 실행 로직 | `features/reset` |
| 그래프 캔버스 + 커밋 리스트 조합 | `widgets/graph-view` |
| host에 메시지 보내는 postMessage 래퍼 | `shared/api` |
| 여러 feature가 쓰는 확인 다이얼로그 골격 | `shared/ui` |
| glob 매칭 유틸 | `shared/lib` |

## SolidJS 관련 규칙

- 상태는 슬라이스의 `model/`에 signal/store로 둔다. 전역 store 남발 금지 — 전역이 필요한 건 그래프 데이터, 설정 정도
- 컴포넌트는 props로 entity 타입을 받는다. features가 entities의 컴포넌트를 조합
- `createResource`/메시지 응답 처리는 `shared/api`의 bridge 클라이언트를 통해서만
