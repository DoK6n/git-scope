# 30. 검색 · 필터

그래프 뷰에서 커밋을 찾고, 표시할 브랜치 범위를 좁히는 기능. 모든 동작은 관찰 가능한 UI 동작으로만 기술한다.

**상태 태그**: `[todo]` 구현 예정 · `[wip]` 진행 중 · `[done]` 완료 · `[skip]` 구현 안 함 · `[changed]` 원본과 다르게 감

---

## 30.1 커밋 검색 (Find Widget)

### 30.1.1 열기 / 닫기 [todo]

- 그래프 뷰에 포커스가 있을 때 `Ctrl/Cmd + F`로 검색 위젯을 연다. (출처: README Keyboard Shortcuts)
- `Escape`로 활성 다이얼로그·컨텍스트 메뉴·커밋 상세 뷰를 닫는다. 검색 위젯도 동일하게 닫히는 대상으로 다룬다. (출처: README Keyboard Shortcuts)
- 이 단축키는 설정으로 재지정 가능하다. 원본은 `keyboardShortcut.find` 키에 `UNASSIGNED` 또는 `CTRL/CMD + A~Z` 중 하나를 지정하며 기본값은 `CTRL/CMD + F`다. (출처: 원본 package.json `contributes.configuration`)
  - GitScope에서는 `gitScope.keyboardShortcut.find`로 재명명한다. 상세는 `50-settings.md`.

### 30.1.2 검색 대상 필드 [todo]

입력한 문구를 아래 필드 전체에 대해 조회한다. (출처: README / 마켓플레이스)

| 대상 | 비고 |
|---|---|
| 커밋 메시지 | 제목(subject) + 본문(body) |
| 커밋 날짜 | 그래프에 표시되는 형식의 날짜 문자열 |
| 작성자(author) | 이름 및 이메일 |
| 커밋 해시 | 부분 일치 허용(접두 일부만 입력해도 매칭) |
| 브랜치 이름 | 로컬·리모트 |
| 태그 이름 | |

- 필드를 지정해서 검색하는 UI는 원본에 없다. 하나의 입력란에 넣은 문구가 위 필드 전체에 동시에 적용된다. (출처: README — "containing a specific phrase (in the commit message / date / author / hash, branch or tag names)")

### 30.1.3 매칭 방식 [todo]

- 부분 문자열 포함(substring) 매칭. 정규식·완전 일치 모드는 원본에 없다. (출처: README)
- 대소문자 구분 여부는 허용 소스에서 확인되지 않았다. GitScope는 **대소문자 무시**를 기본으로 하고, 필요 시 옵션화한다. `[changed]` 가능성 있음 — 블랙박스 관찰로 확정 필요.
- 검색 대상은 **현재 로드된 커밋**에 한정된다. 원본은 초기 300건을 로드하고 스크롤 시 100건씩 추가 로드하는 구조이므로, 아직 로드되지 않은 커밋은 검색 결과에 포함되지 않는다. (출처: 원본 package.json — `repository.commits.initialLoad` 기본 300, `repository.commits.loadMore` 기본 100)
  - 이 제약은 원본의 실질적 불편 지점이다. 개선안은 `60-new-features.md`에서 다룬다.

### 30.1.4 결과 표시 및 이동 [todo]

- 조건에 맞는 커밋이 **여러 건** 표시된다("one or more commits"). 즉 단건 점프가 아니라 매칭 집합을 훑는 형태다. (출처: README)
- 매칭된 커밋 행 및 매칭된 텍스트 구간이 시각적으로 강조된다.
- 위젯 내에서 이전/다음 매칭으로 순차 이동할 수 있으며, 이동 시 해당 커밋이 뷰포트 안으로 스크롤된다.
- 매칭 건수 표시(예: `3 / 12`)를 제공한다.
- 검색 위젯을 닫으면 강조 표시가 해제된다.
- ※ 강조·순차 이동·건수 표시의 구체적 UI 형태는 허용 소스에 문서화되어 있지 않다. 위 항목은 GitScope의 요구사항으로 정의한 것이며, 원본과의 일치 여부는 검증 대상이 아니다.

### 30.1.5 검색과 무관한 스크롤 단축키 [todo]

검색 위젯은 아니지만 "원하는 커밋으로 이동"이라는 같은 목적을 가지는 보조 기능. (출처: README Keyboard Shortcuts / 원본 package.json)

| 단축키(기본) | 동작 | 설정 키(원본) |
|---|---|---|
| `Ctrl/Cmd + H` | HEAD가 가리키는 커밋을 화면 중앙으로 스크롤 | `keyboardShortcut.scrollToHead` |
| `Ctrl/Cmd + S` | 로드된 커밋 중 첫 번째(또는 다음) 스태시로 스크롤 | `keyboardShortcut.scrollToStash` |
| `Ctrl/Cmd + Shift + S` | 마지막(또는 이전) 스태시로 스크롤 | 위와 동일 키에 Shift 수식 |
| `Ctrl/Cmd + R` | 그래프 뷰 새로고침 | `keyboardShortcut.refresh` |

- HEAD 스크롤은 HEAD 커밋이 **로드된 커밋 범위 안에 있을 때만** 동작한다. (출처: 원본 package.json — `keyboardShortcut.scrollToHead` 설명)

---

## 30.2 브랜치 필터 드롭다운

### 30.2.1 위치와 기본 동작 [done]

- 그래프 뷰 상단 컨트롤 바에 "Branches" 드롭다운이 있고, 여기서 그래프에 표시할 브랜치를 고른다. (출처: README)
- 필터 옵션은 세 가지다. (출처: README)
  1. **Show All** — 모든 브랜치 표시
  2. **개별 브랜치 선택** — 하나 이상의 브랜치를 선택해 그 브랜치들만 표시
  3. **커스텀 glob 패턴 선택** — 설정에 미리 정의해 둔 패턴 목록에서 선택
- GitScope 구현 노트:
  - 드롭다운 트리거는 select 룩으로 현재 상태(`Show All` / 선택 1건이면 그 이름 / `N branches`)를 표시한다.
  - 항목은 체크마크(✓) 행으로 표시하고 클릭 즉시 적용된다(Apply 버튼 없음). 선택이 모두 풀리면 Show All로 복귀.
  - 목록은 그룹으로 나뉜다: `Show All` ─ divider ─ 로컬 브랜치 ─ divider ─ 원격별 그룹(`origin` 등, 마지막 그룹). 원격 그룹에는 이탤릭 그룹 라벨을 붙이고 브랜치명은 원격 접두를 뗀 이름으로 표시한다.
  - 커스텀 사전 등록 glob(3) 대신 드롭다운 상단 "Filter Branches…" 입력에서 즉석 glob으로 목록을 좁힌다(→ 30.4.1). `[changed]`
  - **필터 적용 시 체크아웃된 브랜치(HEAD)는 자동 포함되지 않는다** — 선택한 브랜치들만 정확히 표시된다. (초기 구현은 `git log`에 HEAD를 항상 넘겨 필터가 무력화되는 버그가 있었음 — v0.5.0에서 수정)

### 30.2.2 단일 / 다중 선택 [done]

- 다중 선택을 지원한다("Select one or more branches to be viewed"). 선택된 브랜치들의 커밋 이력이 합집합으로 표시된다. (출처: README)
- 선택 상태는 커밋 컨텍스트 메뉴가 아니라 **브랜치 라벨 컨텍스트 메뉴**에서도 조작할 수 있다. 원본은 로컬 브랜치·리모트 브랜치 컨텍스트 메뉴에 다음 두 항목을 둔다. (출처: 원본 package.json `contextMenuActionsVisibility.branch` / `.remoteBranch`)
  - `Select in Branches Dropdown` — 해당 브랜치를 드롭다운 선택에 추가
  - `Unselect in Branches Dropdown` — 선택에서 제거
- 즉 드롭다운은 "현재 선택 집합"을 유지하는 상태 저장 컨트롤이며, 그래프의 브랜치 라벨에서도 그 집합을 편집할 수 있다.

### 30.2.3 "Show All" 동작 [done]

- Show All을 고르면 개별 브랜치·glob 선택이 모두 해제되고 전체 브랜치가 표시된다. (출처: README)
- 전체 표시 상태에서만 적용되는 부가 옵션이 있다: reflog에만 언급된 커밋 포함 여부는 "모든 브랜치를 표시할 때만" 적용된다. (출처: 원본 package.json — `repository.includeCommitsMentionedByReflogs` 설명)

### 30.2.4 초기 선택 상태 (리포지토리 로드 시) [todo]

리포지토리를 열 때의 기본 필터 상태를 설정으로 정한다. 두 설정은 함께 쓸 수 있다. (출처: 위키 Extension Settings / 원본 package.json)

| 설정(원본 키) | 타입 | 기본값 | 동작 |
|---|---|---|---|
| `repository.onLoad.showCheckedOutBranch` | boolean | `false` | 로드 시 체크아웃된 브랜치를 선택 상태로 둔다. `false`면 전체 표시 |
| `repository.onLoad.showSpecificBranches` | string[] | `[]` | 로드 시 선택할 브랜치 지정. 빈 배열이면 전체 표시 |

- `showSpecificBranches`의 각 항목이 가질 수 있는 형태 (출처: 원본 package.json 설명):
  - 로컬 브랜치명 — 예: `master`
  - `remotes/` 접두를 붙인 리모트 추적 브랜치명 — 예: `remotes/origin/master`
  - `--glob=` 접두를 붙인, 커스텀 glob 패턴 설정에 정의된 패턴 — 예: `--glob=heads/feature/*`

### 30.2.5 커스텀 브랜치 glob 패턴 [todo]

- 원본은 설정에 이름 붙인 glob 패턴 배열을 정의해 두고, 그 이름들을 Branches 드롭다운의 선택지로 노출한다. (출처: README / 원본 package.json `customBranchGlobPatterns`)
- 패턴 항목의 형태 (출처: 원본 package.json):
  - `name` — 드롭다운에 표시될 이름 (필수)
  - `glob` — `git log --glob=<glob-pattern>`에 그대로 전달되는 glob 패턴 (필수). 예: `heads/feature/*`
  - 예시 값: `[{"name": "Feature Requests", "glob": "heads/feature/*"}]`
- 즉 **원본의 glob은 "설정 파일에 미리 등록해 둔 패턴을 드롭다운에서 고르는" 방식이며, 검색창에 즉석으로 패턴을 입력하는 기능이 아니다.** 이 제약이 GitScope 확장의 출발점이다(→ 30.4).

---

## 30.3 표시 범위 토글 (필터에 준하는 동작)

브랜치 드롭다운과 별개로, 그래프에 어떤 종류의 참조를 포함할지 켜고 끄는 토글들. 전역 설정이 기본값이 되고, 일부는 리포지토리별로 컨트롤 바·리포지토리 설정 위젯에서 덮어쓸 수 있다. (출처: 위키 Extension Settings / 원본 package.json)

| 대상 | 설정 키(원본) | 기본값 | 리포지토리별 덮어쓰기 | 상태 |
|---|---|---|---|---|
| 리모트 브랜치 | `repository.showRemoteBranches` | `true` | 컨트롤 바 | [done] |
| 리모트 HEAD 심볼릭 참조 (`origin/HEAD` 등) | `repository.showRemoteHeads` | `true` | — | [done] |
| 태그 | `repository.showTags` | `true` | 리포지토리 설정 위젯 | [todo] |
| 스태시 | `repository.showStashes` | `true` | 리포지토리 설정 위젯 | [todo] |
| Uncommitted changes | `repository.showUncommittedChanges` | `true` | — | [todo] |
| 추적되지 않은 파일 | `repository.showUntrackedFiles` | `true` | — | [todo] |
| 태그로만 참조되는 커밋 | `repository.showCommitsOnlyReferencedByTags` | `true` | — | [todo] |
| reflog에만 언급된 커밋 | `repository.includeCommitsMentionedByReflogs` | `false` | 리포지토리 설정 위젯 | [skip] |
| 첫 번째 부모만 따라가기 (`--first-parent`) | `repository.onlyFollowFirstParent` | `false` | 리포지토리 설정 위젯 | [todo] |

- `showUncommittedChanges` / `showUntrackedFiles`를 끄면 큰 리포지토리에서 로드 시간이 줄어든다고 명시되어 있다. 즉 이 토글들은 순수 표시 옵션이 아니라 조회 비용에 직접 영향을 준다. (출처: 원본 package.json 설명)
- GitScope 구현 노트 (리모트 브랜치 / 리모트 HEAD):
  - **Show Remote Branches** 체크박스를 브랜치 드롭다운 내부 상단(헤더)에 둔다. 끄면 `git log`에서 `--remotes`를 빼고 원격 ref를 뱃지·드롭다운에서도 제외하며, 필터에 남아 있던 원격 브랜치 선택도 함께 해제한다. VS Code 설정이 아닌 세션 상태다. `[changed]`
  - `origin/HEAD` 심볼릭 참조는 항상 뱃지로 표시한다(전용 설정 없음). 필터 드롭다운·브랜치 액션 대상에서는 제외하고, 우클릭 메뉴는 Copy만 제공한다. `[changed]`
- 커밋 정렬 순서(`date` / `author-date` / `topo`)도 컬럼 헤더 컨텍스트 메뉴에서 리포지토리별로 바꿀 수 있다. 필터는 아니지만 같은 컨트롤 계열이다. 상세는 `10-graph-view.md`. (출처: 원본 package.json `repository.commits.order`)

---

## 30.4 GitScope 확장

### 30.4.1 브랜치명 · 커밋 메시지 glob 패턴 검색 [todo]

원본의 한계 — glob은 (a) 설정 파일에 사전 등록해야만 쓸 수 있고, (b) **브랜치에만** 적용되며, (c) 커밋 메시지에는 패턴 검색 수단이 전혀 없다(Find Widget은 단순 부분 문자열 매칭뿐).

GitScope는 다음을 추가한다.

- **즉석 glob 입력** — 브랜치 필터와 커밋 검색 입력란에서 설정 등록 없이 바로 패턴을 입력할 수 있다.
- **지원 메타문자** — `*` (0자 이상), `?` (임의의 1자), `[...]` (문자 클래스).
- **적용 대상** — 브랜치명(로컬·리모트), 커밋 메시지(제목 + 본문).
- **일반 문자열 검색과의 공존** — 패턴 메타문자가 없는 입력은 기존과 동일하게 부분 문자열 매칭으로 동작한다.

> 상세 명세는 `60-new-features.md` 참조.

### 30.4.2 브랜치 필터 드롭다운 list / tree 뷰 [done]

원본의 브랜치 드롭다운은 평면 목록뿐이다. GitScope는 Tree/List 토글을 제공하며, v0.5.0에서 List 뷰를 그룹형으로 리디자인했다.

- 드롭다운 헤더: **Show Remote Branches** 토글 + **Tree | List** 전환 (기본: List)
- **List**: `Show All` ─ divider ─ 로컬 브랜치 ─ divider ─ 원격별 그룹(마지막, 이탤릭 그룹 라벨 + 접두 뗀 이름) 구조. 체크마크(✓) 행
- **Tree**: 브랜치명을 `/` 세그먼트로 폴더 그룹핑 (예: `origin/feature/a` → `origin` > `feature` > `a`)
  - 브랜치 없이 하위 폴더 하나뿐인 체인은 `a/b`로 압축 (변경 파일 트리와 동일 규칙)
  - 폴더는 ▸/▾로 접기/펼치기 (기본 모두 펼침), leaf는 마지막 세그먼트만 표시(hover 시 전체 이름)
  - 폴더 체크박스 = 하위 브랜치 일괄 선택/해제, 일부만 선택 시 indeterminate 표시
- 두 뷰 모두 선택은 클릭 즉시 적용되고, "Filter Branches…" glob 입력이 동일하게 선적용된다
- 선택 집합(= 현재 필터)은 뷰 전환과 무관하게 유지된다

### 30.4.3 원격에만 존재하는 브랜치 숨기기 [done]

(출처: GitScope 로드맵 R-28~R-31)

- 브랜치 드롭다운 상단에서 **Hide remote-only branches**를 켜고 끌 수 있다. 기본값은 꺼짐이며 VS Code 설정이 아닌 현재 webview 세션 상태로 유지된다.
- 켜면 대응하는 로컬 브랜치가 없는 원격 브랜치를 그래프 조회 범위·레퍼런스 뱃지·브랜치 필터 목록에서 제외한다. 예를 들어 로컬 `feature/a`가 있으면 `origin/feature/a`는 남지만, 로컬이 없는 `origin/feature/b`는 숨긴다.
- 대응 여부는 원격 이름을 뺀 브랜치명으로 판단한다. 같은 이름의 로컬 브랜치가 하나라도 있으면 어느 원격의 대응 브랜치든 표시한다.
- 기존 **Show Remote Branches**는 원격 브랜치 전체를 표시하거나 숨기는 상위 토글이다. 이 값이 꺼져 있으면 원격 전용 토글의 값과 관계없이 원격 브랜치는 모두 숨겨진다.
- 원격 전용 브랜치가 현재 선택 필터에 들어 있던 상태에서 토글을 켜면 그 브랜치를 선택 집합에서도 제거한다. 나머지 로컬·대응 원격 선택은 유지하며, 선택이 모두 없어지면 기존 규칙대로 Show All로 돌아간다.
- 저장소를 전환해도 토글 값은 세션 동안 유지되고, 새 저장소의 로컬·원격 브랜치 대응 관계에 다시 적용된다. 브랜치 선택 집합은 기존처럼 저장소 전환 시 초기화한다.

---

## 출처 요약

| 약칭 | 실제 출처 |
|---|---|
| README | https://raw.githubusercontent.com/mhutchie/vscode-git-graph/master/README.md |
| 마켓플레이스 | https://marketplace.visualstudio.com/items?itemName=mhutchie.git-graph |
| 위키 Extension Settings | https://github.com/mhutchie/vscode-git-graph/wiki/Extension-Settings |
| 원본 package.json | 로컬 `../vscode-git-graph/package.json`의 `contributes` 섹션 (클린룸 허용 범위) |

원본 구현 소스(`src/`, `web/`)는 참조하지 않았다.
