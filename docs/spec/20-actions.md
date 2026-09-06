# 20 — 컨텍스트 액션 명세

그래프 위에서 실행 가능한 git 액션의 전체 인벤토리. 대상(커밋 / 브랜치 / 원격 브랜치 / 태그 / 스태시 / uncommitted changes / 툴바)별로 정리한다.

> **클린룸**: 이 문서는 원본 위키(Context Menus, Extension Settings), README, 로컬 `vscode-git-graph/package.json`의 `contributes` 메타데이터만을 근거로 작성했다. 원본 소스 코드는 참조하지 않았다. 기준 원본 버전: `1.30.0` (출처: package.json)

## 상태 태그 범례

| 태그 | 의미 |
|---|---|
| `[todo]` | 구현 예정 — M3 기본 액션 범위 |
| `[done]` | 구현 예정 — M5 패리티 보강 단계로 미룸 |
| `[changed]` | 원본과 다르게 구현 (확장·개선) |
| `[skip]` | 구현하지 않음 |

---

## 0. 공통 규약

모든 액션은 아래 흐름을 공유한다. 개별 액션 항목에서는 차이점만 기술한다.

1. **대상 우클릭** → 컨텍스트 메뉴 표시
2. **메뉴 항목 선택**
3. **입력/확인 단계** — 메뉴 라벨이 `...`으로 끝나는 항목은 다이얼로그를 띄우고, `...`이 없는 항목은 즉시 실행한다 (출처: 위키 Context Menus의 라벨 표기)
4. **실행** — 실패 시 에러 메시지 표시, 그래프 상태는 변경 없음
5. **그래프 갱신** — 성공 시 그래프·라벨·HEAD 표시가 자동으로 다시 그려진다

### 공통 규칙

- **클립보드 액션 예외**: `Copy ... to Clipboard` 류는 다이얼로그·확인 없이 즉시 실행하며 **그래프를 갱신하지 않는다**.
- **다이얼로그 기본값은 설정으로 제어**: 각 다이얼로그의 체크박스·드롭다운 초기 상태는 설정 항목으로 바꿀 수 있다. 원본은 `gitScope.dialog.*` 대응 위치에 이 값들을 둔다 (출처: 위키 Extension Settings). 상세는 `50-settings.md`.
- **레퍼런스 입력 필드의 공백 치환**: 브랜치명·태그명 등 레퍼런스 이름을 입력하는 필드에 공백을 입력·붙여넣기하면 설정에 따라 하이픈/언더스코어로 자동 치환하거나 그대로 둔다 (기본: 치환 없음) (출처: `dialog.general.referenceInputSpaceSubstitution`).
- **다이얼로그 키보드 조작**: `Enter`로 확정, `Escape`로 취소 (출처: README 키보드 단축키).
- **서명**: 커밋 생성·태그 생성을 유발하는 액션은 설정이 켜져 있으면 GPG/X.509 서명을 적용한다 (기본: 꺼짐) (출처: `repository.sign.commits`, `repository.sign.tags`).
- **컨텍스트 메뉴 항목 표시 여부 설정**: 원본은 대상별로 각 액션의 표시 여부를 boolean으로 켜고 끌 수 있는 설정을 제공한다 (출처: `contextMenuActionsVisibility`). GitScope도 동일 구조를 따른다 — `50-settings.md` 참조.

### ⚠️ 위험 액션 정책

되돌리기 어려운 작업 손실을 유발할 수 있는 액션은 **작업 내용을 명시한 확인 다이얼로그를 필수**로 한다. 아래 표의 액션이 해당한다.

| 액션 | 손실 대상 |
|---|---|
| `reset --hard` (브랜치 / uncommitted) | 워킹 트리·인덱스 변경 |
| `Clean untracked files` | 추적되지 않은 파일 |
| `Delete Branch` (force) | 머지되지 않은 커밋 |
| `Delete Remote Branch` | 원격 브랜치 |
| `Delete Tag` | 태그 (원격 포함 시) |
| `Drop Stash` | 스태시 |
| `Drop Commit` | 커밋 |
| force push / force fetch | 원격 또는 로컬 브랜치 이력 |

---

## 1. 커밋 우클릭 (11개)

(출처: 위키 Context Menus, `contextMenuActionsVisibility.commit`)

| # | 메뉴 항목 | 상태 | 흐름 |
|---|---|---|---|
| 1 | Add Tag... | `[todo]` | ↓ 1.1 |
| 2 | Create Branch... | `[todo]` | ↓ 1.2 |
| 3 | Checkout... | `[todo]` | ↓ 1.3 |
| 4 | Cherry Pick... | `[done]` | ↓ 1.4 |
| 5 | Revert... | `[done]` | ↓ 1.5 |
| 6 | Drop... | `[done]` | ↓ 1.6 |
| 7 | Merge into current branch... | `[todo]` | ↓ 1.7 |
| 8 | Rebase current branch on this Commit... | `[done]` | ↓ 1.8 |
| 9 | Reset current branch to this Commit... | `[changed]` | ↓ 1.9 |
| 10 | Copy Commit Hash to Clipboard | `[todo]` | 즉시 실행, 갱신 없음 |
| 11 | Copy Commit Subject to Clipboard | `[todo]` | 즉시 실행, 갱신 없음 |

### 1.1 Add Tag... `[todo]`

우클릭 → `Add Tag...` → 다이얼로그:

- 태그 이름 입력 (필수)
- 태그 타입 선택: Annotated / Lightweight (기본: Annotated) (출처: `dialog.addTag.type`)
- 메시지 입력 — Annotated 선택 시
- `Push to remote` 체크박스 (기본: 해제). 체크 시 태그 생성 후 원격 push까지 이어서 수행 (출처: `dialog.addTag.pushToRemote`)

확정 → 태그 생성 → 해당 커밋에 태그 라벨이 붙은 상태로 그래프 갱신.

### 1.2 Create Branch... `[todo]`

우클릭 → `Create Branch...` → 다이얼로그:

- 브랜치 이름 입력 (필수)
- `Check out` 체크박스 (기본: 해제). 체크 시 브랜치 생성 후 즉시 체크아웃 (출처: `dialog.createBranch.checkOut`)

확정 → 브랜치 생성 → 브랜치 라벨 추가(및 체크아웃 시 HEAD 이동) 후 그래프 갱신.

### 1.3 Checkout... `[todo]`

우클릭 → `Checkout...` → 확인 다이얼로그 → 실행.

커밋을 직접 체크아웃하므로 결과는 **detached HEAD** 상태다. 확인 다이얼로그에서 이 사실을 사용자에게 알려야 한다. 실행 후 HEAD 표시가 해당 커밋으로 이동한 상태로 그래프 갱신.

### 1.4 Cherry Pick... `[done]`

우클릭 → `Cherry Pick...` → 다이얼로그:

- `Record Origin` 체크박스 (기본: 해제) — 커밋 메시지에 원본 커밋 출처를 기록 (출처: `dialog.cherryPick.recordOrigin`)
- `No Commit` 체크박스 (기본: 해제) — 변경만 스테이징하고 커밋은 만들지 않음 (출처: `dialog.cherryPick.noCommit`)
- 대상이 **머지 커밋**인 경우: 어느 부모를 기준으로 체리픽할지 선택하는 입력이 추가로 필요하다

확정 → 실행 → 현재 브랜치 끝에 새 커밋이 생긴 상태로 그래프 갱신. 충돌 시 git이 충돌 상태를 남기고, 해결은 VS Code 내장 merge editor에 위임한다 (Plan 비목표: GUI 충돌 해결 안 함).

### 1.5 Revert... `[done]`

우클릭 → `Revert...` → 다이얼로그:

- 대상이 **머지 커밋**인 경우: mainline 부모 선택 입력
- 일반 커밋인 경우: 확인만

확정 → 실행 → 되돌리는 새 커밋이 추가된 상태로 그래프 갱신.

### 1.6 ⚠️ Drop... `[done]`

우클릭 → `Drop...` → 확인 다이얼로그 (필수 — 커밋이 이력에서 제거됨) → 실행 → 그래프 갱신.

**메뉴 항목 자체가 조건부로만 표시된다**: 위상적으로(topologically) 드롭이 가능한 커밋에서만 나타난다 (출처: 위키 Context Menus). 이력 재작성을 수반하므로 rebase 기반 구현이 갖춰지는 M5 이후로 미룬다.

### 1.7 Merge into current branch... `[todo]`

우클릭 → `Merge into current branch...` → 다이얼로그:

- `No Commit` 체크박스 (기본: 해제) (출처: `dialog.merge.noCommit`)
- `Create a new commit even if fast-forward is possible` 체크박스 (**기본: 체크됨**) (출처: `dialog.merge.noFastForward`)
- `Squash Commits` 체크박스 (기본: 해제) (출처: `dialog.merge.squashCommits`)
- squash 커밋 메시지 형식 드롭다운: Default / Git SQUASH_MSG (기본: Default) — `Squash Commits`가 켜진 경우에만 유효 (출처: `dialog.merge.squashMessageFormat`)

확정 → 실행 → 머지 커밋(또는 fast-forward 결과)이 반영된 상태로 그래프 갱신. 충돌 시 내장 merge editor에 위임.

### 1.8 Rebase current branch on this Commit... `[done]`

우클릭 → `Rebase current branch on this Commit...` → 다이얼로그:

- `Ignore Date` 체크박스 (**기본: 체크됨**) — 비대화형 rebase에만 적용 (출처: `dialog.rebase.ignoreDate`)
- `Launch Interactive Rebase in new Terminal` 체크박스 (기본: 해제) (출처: `dialog.rebase.launchInteractiveRebase`)

확정 →
- 비대화형: 그대로 실행하고 그래프 갱신
- 대화형: 통합 터미널을 새로 열어 interactive rebase를 넘긴다. 터미널 작업이 끝난 뒤의 갱신은 사용자의 수동 refresh 또는 파일 감시에 의존한다.

### 1.9 ⚠️ Reset current branch to this Commit... `[changed]`

**원본 동작** (출처: 위키 Context Menus, `dialog.resetCurrentBranchToCommit.mode`):

우클릭 → `Reset current branch to this Commit...` → 다이얼로그에서 모드 드롭다운 선택 (Soft / Mixed / Hard, 기본 Mixed) → 확정 → 실행 → 그래프 갱신.

**GitScope 변경점**: 모드 선택 외에 `HEAD~N` 형태의 상대 타겟 지정 UI를 추가한다. `--hard` 선택 시에는 손실되는 변경 내용을 명시한 별도 확인 단계를 필수로 둔다. 상세 명세는 **`60-new-features.md`에서 확장**한다 (Plan 필수 신규 기능 #1).

---

## 2. uncommitted changes 우클릭 (4개)

그래프 최상단의 uncommitted changes 항목을 우클릭한다 (출처: 위키 Context Menus, `contextMenuActionsVisibility.uncommittedChanges`).

| # | 메뉴 항목 | 상태 | 흐름 |
|---|---|---|---|
| 1 | Stash uncommitted changes... | `[done]` | ↓ 2.1 |
| 2 | Reset uncommitted changes... | `[changed]` | ↓ 2.2 |
| 3 | Clean untracked files... | `[done]` | ↓ 2.3 |
| 4 | Open Source Control View | `[todo]` | ↓ 2.4 |

### 2.1 Stash uncommitted changes... `[done]`

우클릭 → `Stash uncommitted changes...` → 다이얼로그:

- 스태시 메시지 입력 (선택)
- `Include Untracked` 체크박스 (**기본: 체크됨**) (출처: `dialog.stashUncommittedChanges.includeUntracked`)

확정 → 실행 → uncommitted changes 항목이 사라지고 스태시 항목이 그래프에 추가된 상태로 갱신.

### 2.2 ⚠️ Reset uncommitted changes... `[changed]`

**원본 동작**: 우클릭 → 모드 드롭다운 선택 (Mixed / Hard — 브랜치 reset과 달리 **Soft 없음**, 기본 Mixed) → 확정 → 실행 → 그래프 갱신 (출처: `dialog.resetUncommittedChanges.mode`).

`Hard` 선택 시 워킹 트리 변경이 소실되므로 확인 단계 필수. GitScope 확장 내용은 **`60-new-features.md`** 참조.

### 2.3 ⚠️ Clean untracked files... `[done]`

우클릭 → `Clean untracked files...` → 확인 다이얼로그 (필수 — 추적되지 않은 파일이 삭제되며 복구 불가) → 실행 → 그래프 갱신.

### 2.4 Open Source Control View `[todo]`

우클릭 → 즉시 실행. VS Code의 소스 제어 뷰를 포커스한다. git 상태를 바꾸지 않으므로 그래프 갱신 없음.

---

## 3. 로컬 브랜치 라벨 우클릭 (12개)

(출처: 위키 Context Menus, `contextMenuActionsVisibility.branch`)

원본은 **체크아웃 여부에 따라 메뉴 구성이 달라진다**. 현재 체크아웃된 브랜치에서는 자기 자신에 대해 의미가 없는 항목(Checkout / Delete / Merge / Rebase)이 빠진다 (출처: 위키 Context Menus — "Local & Checked Out" 목록).

| # | 메뉴 항목 | 체크아웃된 브랜치에서 | 상태 | 흐름 |
|---|---|---|---|---|
| 1 | Checkout Branch | 숨김 | `[todo]` | ↓ 3.1 |
| 2 | Rename Branch... | 표시 | `[todo]` | ↓ 3.2 |
| 3 | Delete Branch... | 숨김 | `[todo]` | ↓ 3.3 |
| 4 | Merge into current branch... | 숨김 | `[todo]` | 1.7과 동일 (대상만 브랜치) |
| 5 | Rebase current branch on Branch... | 숨김 | `[done]` | 1.8과 동일 (대상만 브랜치) |
| 6 | Push Branch... | 표시 | `[done]` | ↓ 3.4 |
| 7 | View Issue | 표시 | `[skip]` | ↓ 3.7 |
| 8 | Create Pull Request... | 표시 | `[skip]` | ↓ 3.7 |
| 9 | Create Archive | 표시 | `[skip]` | ↓ 3.7 |
| 10 | Select in Branches Dropdown | 표시 | `[done]` | ↓ 3.5 |
| 11 | Unselect in Branches Dropdown | 표시 | `[done]` | ↓ 3.5 |
| 12 | Copy Branch Name to Clipboard | 표시 | `[todo]` | 즉시 실행, 갱신 없음 |

### 3.1 Checkout Branch `[todo]`

라벨 우클릭 → `Checkout Branch` → **다이얼로그·확인 없이 즉시 실행** (원본 라벨에 `...`이 없음) → HEAD 표시가 해당 브랜치로 이동한 상태로 그래프 갱신.

### 3.2 Rename Branch... `[todo]`

우클릭 → `Rename Branch...` → 다이얼로그에서 새 이름 입력 (기존 이름이 채워진 상태로 시작) → 확정 → 실행 → 브랜치 라벨 텍스트가 바뀐 상태로 그래프 갱신.

### 3.3 ⚠️ Delete Branch... `[todo]`

우클릭 → `Delete Branch...` → 다이얼로그:

- `Force Delete` 체크박스 (기본: 해제) (출처: `dialog.deleteBranch.forceDelete`)

확정 → 실행 → 브랜치 라벨이 제거된 상태로 그래프 갱신.

**확인 필수 조건**: `Force Delete`가 체크된 경우 머지되지 않은 커밋이 참조를 잃을 수 있으므로, 강제 삭제임을 명시한 확인 단계를 반드시 거친다. 미체크 상태에서 머지되지 않아 삭제가 거부되면, 에러를 그대로 보여주고 force 재시도 여부를 사용자가 결정하게 한다.

### 3.4 ⚠️ Push Branch... `[done]`

우클릭 → `Push Branch...` → 다이얼로그:

- 대상 원격 선택 (원격이 여러 개인 경우)
- 업스트림 설정 여부

**메뉴 항목 자체가 조건부**: 리포지토리에 원격이 하나 이상 있을 때만 표시된다 (출처: 위키 Context Menus).

확정 → 실행 → 원격 브랜치 라벨이 갱신된 상태로 그래프 갱신.

> force push 옵션의 존재 여부는 허용 소스(위키·README·`contributes`)에서 확인되지 않았다. GitScope에서 force push를 제공하는 경우 ⚠️ **확인 다이얼로그 필수**로 하고, 기본값은 항상 비활성으로 둔다.

### 3.5 Select / Unselect in Branches Dropdown `[done]`

우클릭 → 즉시 실행. 툴바 Branches 드롭다운의 필터 선택 상태에 해당 브랜치를 추가/제거한다. git 상태는 바꾸지 않지만 **표시되는 커밋 범위가 달라지므로 그래프는 다시 그려진다**. 필터 명세는 `30-search-filter.md` 참조.

### 3.7 `[skip]` 항목 사유

| 항목 | 사유 |
|---|---|
| View Issue | 이슈 트래커 연동 기능. Plan 비목표 — 그래프에 집중 |
| Create Pull Request... | PR 제공자 연동 기능. 별도 설정(커스텀 PR provider) 체계 전체가 따라와야 하므로 제외 |
| Create Archive | git archive 래퍼. 그래프 탐색·조작과 무관 |

---

## 4. 원격 브랜치 라벨 우클릭 (11개)

(출처: 위키 Context Menus, `contextMenuActionsVisibility.remoteBranch`)

| # | 메뉴 항목 | 상태 | 흐름 |
|---|---|---|---|
| 1 | Checkout Branch... | `[changed]` | ↓ 4.1 |
| 2 | Delete Remote Branch... | `[todo]` | ↓ 4.2 |
| 3 | Fetch into local branch... | `[done]` | ↓ 4.3 |
| 4 | Merge into current branch... | `[todo]` | 1.7과 동일 |
| 5 | Pull into current branch... | `[done]` | ↓ 4.4 |
| 6 | View Issue | `[skip]` | 3.7과 동일 |
| 7 | Create Pull Request | `[skip]` | 3.7과 동일 |
| 8 | Create Archive | `[skip]` | 3.7과 동일 |
| 9 | Select in Branches Dropdown | `[done]` | 3.5와 동일 |
| 10 | Unselect in Branches Dropdown | `[done]` | 3.5와 동일 |
| 11 | Copy Branch Name to Clipboard | `[todo]` | 즉시 실행, 갱신 없음 |

### 4.1 Checkout Branch... `[changed]`

우클릭 → `Checkout Branch...` → 다이얼로그에서 생성할 **로컬 추적 브랜치 이름 입력** (원격 브랜치명에서 원격 접두사를 뗀 값이 기본으로 채워진다) → 확정 → 추적 브랜치 생성 + 체크아웃 → 새 로컬 브랜치 라벨과 HEAD 이동이 반영된 상태로 그래프 갱신.

로컬 브랜치의 `Checkout Branch`가 즉시 실행인 것과 달리, 여기는 이름 입력이 필요해 다이얼로그를 거친다 (원본 라벨에 `...`이 붙은 이유).

**GitScope 변경점**: 입력한 로컬 브랜치가 이미 있으면 선택한 원격 ref와의 ahead/behind를 먼저 보여준다. 로컬이 앞서지 않았으면 확인 후 해당 로컬 브랜치를 체크아웃하고 fast-forward 전용 pull을 실행한다. 로컬이 앞섰거나 갈라졌으면 자동 pull 없이 Checkout Only 또는 Cancel만 제공한다. 상세 명세는 `60-new-features.md` §15 참조.

### 4.2 ⚠️ Delete Remote Branch... `[todo]`

우클릭 → `Delete Remote Branch...` → **확인 다이얼로그 필수** (원격 이력에 영향을 주며 다른 사람에게 즉시 전파됨) → 실행 → 원격 브랜치 라벨이 제거된 상태로 그래프 갱신.

### 4.3 ⚠️ Fetch into local branch... `[done]`

우클릭 → `Fetch into local branch...` → 다이얼로그:

- `Force Fetch` 체크박스 (기본: 해제) (출처: `dialog.fetchIntoLocalBranch.forceFetch`)

**메뉴 항목 자체가 조건부**: 대응하는 로컬 브랜치가 존재하고, 그 브랜치가 **체크아웃되어 있지 않을 때만** 표시된다 (출처: 위키 Context Menus).

확정 → 실행 → 로컬 브랜치 위치가 이동한 상태로 그래프 갱신. `Force Fetch`는 로컬 브랜치 이력을 덮어쓸 수 있으므로 ⚠️ 체크 시 확인 단계를 둔다.

### 4.4 Pull into current branch... `[done]`

우클릭 → `Pull into current branch...` → 다이얼로그:

- `Create a new commit even if fast-forward is possible` 체크박스 (기본: 해제 — merge 다이얼로그와 기본값이 **반대**) (출처: `dialog.pullBranch.noFastForward`)
- `Squash Commits` 체크박스 (기본: 해제) (출처: `dialog.pullBranch.squashCommits`)
- squash 커밋 메시지 형식 드롭다운: Default / Git SQUASH_MSG (기본: Default) (출처: `dialog.pullBranch.squashMessageFormat`)

확정 → 실행 → 그래프 갱신. 충돌 시 내장 merge editor에 위임.

---

## 5. 태그 라벨 우클릭 (5개)

(출처: 위키 Context Menus, `contextMenuActionsVisibility.tag`)

| # | 메뉴 항목 | 상태 | 흐름 |
|---|---|---|---|
| 1 | View Details | `[todo]` | ↓ 5.1 |
| 2 | Delete Tag... | `[todo]` | ↓ 5.2 |
| 3 | Push Tag... | `[done]` | ↓ 5.3 |
| 4 | Create Archive | `[skip]` | 3.7과 동일 |
| 5 | Copy Tag Name to Clipboard | `[todo]` | 즉시 실행, 갱신 없음 |

### 5.1 View Details `[todo]`

우클릭 → 즉시 실행. annotated 태그의 상세 정보(태거, 날짜, 메시지, 서명 상태)를 표시한다.

**메뉴 항목 자체가 조건부**: **annotated 태그에서만** 표시된다. lightweight 태그에는 나타나지 않는다 (출처: 위키 Context Menus). 읽기 전용이므로 그래프 갱신 없음.

### 5.2 ⚠️ Delete Tag... `[todo]`

우클릭 → `Delete Tag...` → 다이얼로그:

- 원격에서도 삭제할지 선택 (리포지토리에 원격이 있는 경우)

확정 → 실행 → 태그 라벨이 제거된 상태로 그래프 갱신. 원격 삭제를 함께 수행하는 경우 되돌리기 어려우므로 확인 단계 필수.

### 5.3 Push Tag... `[done]`

우클릭 → `Push Tag...` → 다이얼로그에서 대상 원격 선택 → 확정 → 실행.

**메뉴 항목 자체가 조건부**: 원격이 하나 이상 있을 때만 표시된다 (출처: 위키 Context Menus). 로컬 그래프 모양은 바뀌지 않지만 push 결과를 반영해 갱신한다.

---

## 6. 스태시 우클릭 (6개)

스태시 커밋 노드 또는 스태시 라벨 어느 쪽을 우클릭해도 동일한 메뉴가 나온다 (출처: 위키 Context Menus, `contextMenuActionsVisibility.stash`).

| # | 메뉴 항목 | 상태 | 흐름 |
|---|---|---|---|
| 1 | Apply Stash... | `[done]` | ↓ 6.1 |
| 2 | Create Branch from Stash... | `[done]` | ↓ 6.2 |
| 3 | Pop Stash... | `[done]` | ↓ 6.3 |
| 4 | Drop Stash... | `[done]` | ↓ 6.4 |
| 5 | Copy Stash Name to Clipboard | `[done]` | 즉시 실행, 갱신 없음 |
| 6 | Copy Stash Hash to Clipboard | `[done]` | 즉시 실행, 갱신 없음 |

> 스태시는 이름(`stash@{N}`)과 해시를 각각 별도 항목으로 복사할 수 있다 — 커밋(해시/제목)과는 다른 조합이다.

### 6.1 Apply Stash... `[done]`

우클릭 → `Apply Stash...` → 다이얼로그:

- `Reinstate Index` 체크박스 (기본: 해제) — 스테이징 상태까지 복원 (출처: `dialog.applyStash.reinstateIndex`)

확정 → 실행 → 스태시는 **목록에 그대로 남고** uncommitted changes가 생긴 상태로 그래프 갱신.

### 6.2 Create Branch from Stash... `[done]`

우클릭 → `Create Branch from Stash...` → 다이얼로그에서 브랜치 이름 입력 → 확정 → 실행 → 새 브랜치가 체크아웃되고 해당 스태시가 목록에서 제거된 상태로 그래프 갱신.

### 6.3 Pop Stash... `[done]`

우클릭 → `Pop Stash...` → 다이얼로그:

- `Reinstate Index` 체크박스 (기본: 해제) (출처: `dialog.popStash.reinstateIndex`)

확정 → 실행 → 변경이 워킹 트리에 적용되고 **스태시는 목록에서 제거된** 상태로 그래프 갱신. Apply와의 차이는 스태시 제거 여부뿐이다.

### 6.4 ⚠️ Drop Stash... `[done]`

우클릭 → `Drop Stash...` → **확인 다이얼로그 필수** (스태시 내용이 폐기됨) → 실행 → 스태시 항목이 제거된 상태로 그래프 갱신.

---

## 7. 툴바(컨트롤 바) 레벨 액션

그래프 뷰 상단 컨트롤 바에서 대상 선택 없이 실행하는 액션 (출처: README, `contributes.commands`).

| # | 액션 | 상태 | 동작 |
|---|---|---|---|
| 1 | Fetch from Remote(s) | `[changed]` | ↓ 7.1 |
| 2 | Refresh | `[todo]` | ↓ 7.2 |

컨트롤 바에는 이 외에 **Branches 드롭다운**(브랜치 필터), **Find 위젯**(커밋 검색), **Repository 드롭다운**(멀티 리포 선택), **Repository Settings 위젯**이 있다 (출처: README). 이들은 git 액션이 아니므로 각각 `30-search-filter.md` / `50-settings.md`에서 다룬다.

### 7.1 Fetch from Remote(s) `[changed]`

**원본 동작**: 컨트롤 바의 Fetch 버튼을 누르면 모든 원격에서 fetch한다. prune 여부는 **버튼 옆 옵션이 아니라 설정으로만** 제어된다 — 설정이 켜져 있으면 fetch 직전에 존재하지 않는 원격 추적 참조를 정리하고, 태그 prune은 별도 설정 + Git 2.17.0 이상을 요구한다 (둘 다 기본 꺼짐) (출처: `repository.fetchAndPrune`, `repository.fetchAndPruneTags`, 위키 Extension Settings). 명령 팔레트에서도 `Fetch from Remote(s)`로 실행할 수 있다 (출처: `contributes.commands`).

특정 원격에 대해 prune 옵션을 직접 지정하는 다이얼로그는 Repository Settings 쪽 fetch 경로에만 있다 — `Prune` / `Prune Tags` 체크박스, 둘 다 기본 해제 (출처: `dialog.fetchRemote.prune`, `dialog.fetchRemote.pruneTags`).

**GitScope 변경점**: prune을 설정에만 묻어두지 않고 **fetch 액션에서 직접 선택 가능한 옵션 또는 별도 액션으로 노출**한다. 상세는 **`60-new-features.md`** 참조 (Plan 필수 신규 기능 #4).

실행 후 원격 브랜치 라벨·커밋이 갱신된 상태로 그래프 갱신.

### 7.2 Refresh `[todo]`

컨트롤 바 또는 키보드 단축키(`CTRL/CMD + R`)로 실행 (출처: README 키보드 단축키). git 상태를 바꾸지 않고 그래프를 다시 읽어 그린다. 액션 실행 후 자동 갱신이 누락된 경우(예: 대화형 rebase를 터미널에 넘긴 경우)의 수동 복구 경로 역할을 한다.

---

## 8. 이 문서에서 다루지 않는 컨텍스트 메뉴

원본에는 그래프 액션 외에도 아래 컨텍스트 메뉴가 있다. 담당 문서로 넘긴다 (출처: 위키 Context Menus).

| 컨텍스트 메뉴 | 항목 수 | 담당 문서 |
|---|---|---|
| Commit Details View File — View Diff / View File at this Revision / View Diff with Working File / Open File / Reset File to this Revision / 절대·상대 경로 복사 등 | 9 | `40-views.md` |
| Column Visibility (컬럼 헤더 우클릭) — Date / Author / Commit 표시 토글 | 3 | `10-graph-view.md` |
| External Link (이슈 링크·URL·이메일 우클릭) — Open URL / Copy URL | 2 | `40-views.md` |
| Internal Link (부모 커밋 해시 우클릭) — Follow Internal Link | 1 | `40-views.md` |

Commit Details View File 메뉴 중 `Mark as Reviewed` / `Mark as Not Reviewed`는 원본의 Code Review 추적 기능에 속하며 **`[skip]`** — 그래프 집중이라는 Plan 비목표에 따라 구현하지 않는다.

---

## 9. 집계

| 대상 | 액션 수 | M3 `[todo]` | M5 `[todo]` | `[changed]` | `[skip]` |
|---|---|---|---|---|---|
| 커밋 | 11 | 6 | 4 | 1 | 0 |
| uncommitted changes | 4 | 1 | 2 | 1 | 0 |
| 로컬 브랜치 | 12 | 5 | 4 | 0 | 3 |
| 원격 브랜치 | 11 | 3 | 4 | 1 | 3 |
| 태그 | 5 | 3 | 1 | 0 | 1 |
| 스태시 | 6 | 0 | 6 | 0 | 0 |
| 툴바 | 2 | 1 | 0 | 1 | 0 |
| **합계** | **51** | **19** | **21** | **4** | **7** |

- 컨텍스트 메뉴 액션 49개 + 툴바 액션 2개 = **51개**
- 이 문서 범위 외로 넘긴 메뉴 항목 15개는 위 집계에 포함하지 않았다 (§8).
- ⚠️ 위험 액션 **9개**: 브랜치 reset(hard), uncommitted reset(hard), Clean untracked files, Delete Branch(force), Delete Remote Branch, Delete Tag(원격 포함), Drop Stash, Drop Commit, Fetch into local branch(force fetch) — 모두 확인 다이얼로그 필수.
- 조건부 표시 항목 **5개**: Drop Commit(위상적으로 가능할 때), Push Branch·Push Tag(원격 존재 시), Fetch into local branch(대응 로컬 브랜치가 있고 체크아웃되지 않았을 때), View Details(annotated 태그만).
- 여기에 더해 로컬 브랜치 메뉴는 **메뉴 단위 조건부**다: 체크아웃된 브랜치에서는 Checkout / Delete / Merge / Rebase 4항목이 숨겨진다 (§3).
