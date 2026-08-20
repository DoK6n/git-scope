# 10. 커밋 그래프 뷰

GitScope의 핵심 화면인 커밋 그래프 뷰의 **관찰 가능한 동작**을 정의한다. (구현 방법은 기술하지 않는다.)

> 상태 태그: `[todo]` 구현 예정 / `[skip]` 구현 안 함 / `[changed]` 원본과 다르게 감
> 모든 항목은 원본 소스 코드를 보지 않고 위키·README·마켓플레이스 페이지·원본 `package.json`의 `contributes`에서만 추출했다.

---

## 1. 뷰 진입과 전체 레이아웃

- **G-01** `[todo]` 명령 팔레트의 "View Git Graph (git log)" 상당 명령으로 그래프 뷰가 **에디터 탭**으로 열린다. (원본 명령 ID `git-graph.view` → 우리는 `gitScope.view`)
- **G-02** `[todo]` 뷰는 위에서부터 **상단 컨트롤 바 → 커밋 행 테이블(그래프 포함)** 순으로 배치된다. 커밋 목록은 세로 스크롤된다.
- **G-03** `[done]` SCM 패널(소스 제어 타이틀 바)과 상태 표시줄 왼쪽 영역에 그래프 열기 버튼을 노출한다. 상태 표시줄 버튼은 `Git Scope`로 표시되고 클릭하면 `gitScope.view` 명령을 실행한다. `gitScope.showStatusBarItem` 설정으로 노출 여부를 바꿀 수 있다.
- **G-04** `[skip]` 탭 아이콘 색상 테마 선택, 새 탭이 열릴 에디터 그룹 지정. (원본: `tabIconColourTheme`, `openNewTabEditorGroup`)

(출처: 위키 Home, 원본 package.json contributes.commands / contributes.configuration)

---

## 2. 그래프 렌더링

- **G-05** `[todo]` 각 커밋은 커밋 행 왼쪽의 그래프 영역에 **하나의 노드(정점)** 로 그려진다. 노드의 세로 위치는 해당 커밋 행과 정렬된다.
- **G-06** `[todo]` 노드는 **레인(세로 컬럼)** 에 배치된다. 서로 다른 분기 선상의 커밋은 서로 다른 레인을 차지하고, 병합/분기가 끝나면 레인은 회수되어 재사용된다.
- **G-07** `[todo]` 커밋과 그 **부모 커밋**은 엣지(선)로 연결된다. 부모가 2개 이상인 병합 커밋은 부모 수만큼의 엣지를 가진다.
- **G-08** `[todo]` 레인 간 이동(분기·병합) 구간의 엣지는 **곡선(rounded)** 으로 그려진다.
- **G-09** `[changed]` 원본은 그래프 선 모양을 `rounded` / `angular` 중에서 고를 수 있다. GitScope는 **rounded 단일 스타일로 고정**하고 선택 옵션을 두지 않는다. (장식적 선택지 제거)
- **G-10** `[todo]` 각 레인/분기 선은 **색상 팔레트를 순환**하며 색이 부여된다. 팔레트를 다 쓰면 처음 색으로 되돌아간다. 팔레트는 설정으로 교체 가능하다. (원본 기본값: 12색 HEX 배열)
- **G-11** `[todo]` 현재 체크아웃된 브랜치(HEAD)의 위치를 그래프에서 식별할 수 있어야 한다.
- **G-12** `[skip]` 커밋 노드 호버 시 "이 커밋이 HEAD에 포함되는지"와 참조 목록을 보여주는 툴팁.
- **G-13** `[skip]` 병합 커밋 / HEAD의 조상이 아닌 커밋의 텍스트를 흐리게(muted) 표시하는 옵션. (원본: `mute.mergeCommits` 기본 true, `mute.commitsThatAreNotAncestorsOfHead` 기본 false)
- **G-14** `[done]` 스태시(stash)를 그래프에 표시한다. (원본: `showStashes`)
  - 베이스 커밋 바로 위에 합성 노드로 삽입, 노드는 속 빈 원으로 구분
  - 행 왼쪽에 `stash@{N}` **라벨 뱃지** 표시 — 초록 칩 + 상자(box) 글리프, 제목은 `git stash list`의 원문("On <브랜치>: <메시지>") 그대로 (블랙박스 관찰로 원본과 동일한 표시 형식; 아이콘은 자체 제작 SVG)
  - 뱃지/노드/행 어디를 우클릭해도 동일한 스태시 메뉴 (20-actions 참조)

(출처: README, 위키 Extension Settings, 마켓플레이스 페이지)

---

## 3. 커밋 행 컬럼 구성

- **G-15** `[todo]` 커밋 행은 좌→우로 **그래프 / 설명(Description) / 날짜(Date) / 작성자(Author) / 커밋(Commit 해시)** 컬럼으로 구성된다.
- **G-16** `[todo]` 설명 컬럼에는 커밋 메시지의 **첫 줄(제목)** 과, 해당 커밋에 붙은 **레퍼런스 라벨**이 함께 표시된다.
- **G-17** `[todo]` 커밋 컬럼에는 **축약 커밋 해시**가 표시된다.
- **G-18** `[todo]` Date / Author / Commit 컬럼은 **표시·숨김을 토글**할 수 있고, 기본값은 세 컬럼 모두 표시다. (원본 기본값 `{Date: true, Author: true, Commit: true}`)
- **G-19** `[todo]` 각 컬럼의 **너비를 드래그로 조절**할 수 있다. 그래프 컬럼 너비는 레인 수에 따라 자동으로 늘어난다.
- **G-20** `[todo]` 날짜 표시는 **작성자 날짜(author date) / 커밋 날짜(commit date)** 중 선택할 수 있으며 기본은 작성자 날짜다.
- **G-21** `[changed]` 원본은 날짜 형식을 5종(`Date & Time` / `Date Only` / `ISO Date & Time` / `ISO Date Only` / `Relative`)에서 고른다. GitScope는 MVP에서 **`Date & Time`과 `Relative` 2종만** 제공한다.
- **G-22** `[done]` 작성자 아바타: origin이 github.com이면 **GitHub commits API로 작성자 avatar_url 조회 → 이미지 다운로드 → globalStorage 디스크 캐시**(14일 TTL, 네거티브 캐시, rate limit 시 세션 중단). GitHub 리포가 아니거나 아바타가 없으면 Gravatar(identicon) 폴백. `GitScope: Clear Avatar Cache` 명령 제공 (원본의 `clearAvatarCache` 상당). GitLab은 미지원.
- **G-23** `[skip]` 커밋 메시지의 이모지 숏코드 치환, 마크다운 서식 렌더링. (원본: `customEmojiShortcodeMappings`, `markdown`)
- **G-24** `[skip]` 커밋 서명(GPG) 상태 표시. (원본: `showSignatureStatus`)
- **G-25** `[skip]` `.mailmap` 을 적용한 작성자명 정규화. (원본: `useMailmap`)

(출처: README, 위키 Extension Settings, 마켓플레이스 페이지)

---

## 4. 레퍼런스 라벨

- **G-26** `[todo]` 커밋에 붙은 **로컬 브랜치**는 해당 커밋 행에 브랜치명 라벨로 표시된다.
- **G-27** `[todo]` **원격 브랜치**는 `<remote>/<branch>` 형태의 라벨로 표시되며, 로컬 브랜치 라벨과 시각적으로 구분된다.
- **G-28** `[todo]` **태그**는 브랜치 라벨과 구분되는 형태의 라벨로 표시된다.
- **G-29** `[todo]` 현재 체크아웃된 브랜치의 라벨은 **HEAD 표시**로 강조되어, 다른 브랜치 라벨과 구별된다.
- **G-30** `[todo]` 같은 커밋 위에 있고 이름이 대응되는 **로컬·원격 브랜치 라벨을 하나로 합쳐** 표시한다(기본 동작). 설정으로 분리 표시할 수 있다.
- **G-31** `[todo]` 원격 브랜치 표시 / 태그 표시를 각각 **on-off 토글**할 수 있으며 기본은 모두 표시다.
- **G-32** `[skip]` 라벨 정렬 모드 3종 선택(`Normal` / 브랜치 왼쪽·태그 오른쪽 / 브랜치는 그래프에 정렬·태그는 오른쪽). GitScope는 `Normal` 상당의 단일 배치만 제공한다. (원본: `referenceLabels.alignment`)
- **G-33** `[skip]` `origin/HEAD` 같은 **원격 심볼릭 HEAD 참조**의 라벨 표시. (원본: `showRemoteHeads`)
- **G-34** `[skip]` 태그로만 참조되는 커밋을 그래프에 포함할지 여부 옵션. (원본: `showCommitsOnlyReferencedByTags`)
- **G-35** `[skip]` 어노테이티드 태그 상세(이름·이메일·날짜·메시지) 보기 — 40-views 범위.

(출처: README, 위키 Extension Settings, 마켓플레이스 페이지)

---

## 5. Uncommitted Changes 행

- **G-36** `[todo]` 워킹 트리에 커밋되지 않은 변경이 있으면, 커밋 목록 **맨 위에 "Uncommitted Changes" 전용 행**이 추가된다.
- **G-37** `[todo]` 이 행은 그래프상에서 **HEAD 커밋과 연결된 노드**로 그려지며, 일반 커밋 노드와 구별되는 형태(속이 빈 원)로 표시된다.
- **G-38** `[todo]` Uncommitted Changes 행 표시 여부를 설정으로 끌 수 있고, 기본은 표시다.
- **G-39** `[changed]` 원본은 uncommitted 노드를 "변경사항 위치의 빈 원" / "체크아웃된 커밋 위치의 원" 두 방식 중 선택하게 한다. GitScope는 **"변경사항 위치의 빈 원" 방식으로 고정**한다.
- **G-40** `[todo]` 추적되지 않은 파일(untracked)을 변경 집계에 포함할지 설정할 수 있고, 기본은 포함이다.
- **G-41** `[skip]` Uncommitted Changes 행을 클릭했을 때의 변경 파일 목록·비교 뷰 — 40-views 범위.

(출처: 위키 Extension Settings, README)

---

## 6. 증분 로딩과 스크롤

- **G-42** `[todo]` 그래프를 열면 **초기 N개 커밋만 로드**한다. 기본값 300, 설정으로 변경 가능하다.
- **G-43** `[todo]` 로드되지 않은 커밋이 남아 있으면 목록 하단에 **"Load More Commits" 버튼**이 표시된다. 클릭하면 M개(기본 100)를 추가로 로드해 기존 목록 아래에 이어 붙인다.
- **G-44** `[todo]` 추가 로드 시 **이미 그려진 그래프의 레인·색상은 유지**되고, 새 커밋만 아래로 이어져 렌더링된다.
- **G-45** `[todo]` "스크롤이 바닥에 닿으면 자동으로 추가 로드" 옵션이 있으며 기본은 켜짐이다. 꺼져 있으면 버튼 클릭으로만 로드한다.
- **G-46** `[todo]` 더 로드할 커밋이 없으면 Load More 버튼은 사라진다.
- **G-47** `[skip]` 뷰를 열 때 자동으로 HEAD 커밋 위치로 스크롤/센터링하는 옵션. (원본: `onLoad.scrollToHead`)
- **G-48** `[skip]` 뷰를 열 때 체크아웃된 브랜치만 / 지정한 특정 브랜치만 보이도록 하는 초기 필터 옵션. (원본: `onLoad.showCheckedOutBranch`, `onLoad.showSpecificBranches`)

(출처: 위키 Extension Settings, 마켓플레이스 페이지)

---

## 7. 상단 컨트롤 바

- **G-49** `[todo]` **리포지토리 드롭다운** — 워크스페이스에 Git 리포지토리가 2개 이상일 때 표시되며, 선택하면 해당 리포의 그래프로 전환된다. 1개면 숨긴다.
- **G-50** `[todo]` **브랜치 필터 드롭다운** — "모든 브랜치 표시"와 "특정 브랜치만 표시"를 선택한다. 다중 선택을 지원한다.
- **G-51** `[changed]` 원본은 브랜치 glob 패턴을 설정 파일(`customBranchGlobPatterns`)에 미리 등록해야 드롭다운에 나타난다. GitScope는 **드롭다운에서 glob 패턴을 즉석 입력**해 필터링할 수 있게 한다. (필수 신규 기능 — 상세는 `30-search-filter.md`)
- **G-52** `[todo]` **검색(Find) 위젯** — 열면 입력창이 나타나고, 입력한 문자열과 일치하는 커밋을 찾아 강조·이동한다. 메시지·작성자·해시·브랜치/태그명이 검색 대상이다.
- **G-53** `[todo]` **Fetch 버튼** — 클릭하면 모든 원격에서 fetch 하고, 완료 후 그래프를 갱신한다.
- **G-54** `[changed]` 원본은 fetch 시 prune 여부를 설정(`fetchAndPrune`) 또는 다이얼로그 체크박스로만 다룬다. GitScope는 **Fetch 버튼에서 `--prune` 실행을 직접 선택**할 수 있게 한다. (필수 신규 기능 — 상세는 `60-new-features.md`)
- **G-55** `[todo]` **Refresh 버튼** — 리포 상태를 다시 읽어 그래프를 갱신한다. 로드된 커밋 수는 유지한다.
- **G-56** `[skip]` **리포지토리 설정 위젯** — 원격 추가/수정/삭제, 이슈 링크 설정, PR 제공자 설정, 설정 내보내기. MVP 이후.
- **G-57** `[skip]` 통합 터미널에서 해당 리포로 셸을 여는 버튼. (원본: `integratedTerminalShell`)
- **G-58** `[skip]` 리포지토리 드롭다운의 정렬 기준 선택. (원본: `repositoryDropdownOrder`)

(출처: README, 마켓플레이스 페이지, 원본 package.json contributes.configuration)

---

## 8. 정렬·토폴로지 관련 동작

- **G-59** `[todo]` 커밋 나열 순서를 **`date` / `author-date` / `topo`(토폴로지)** 중에서 고를 수 있고 기본은 `date` 다. 선택 결과는 `git log`의 대응 정렬 옵션과 동일한 순서로 관찰된다.
- **G-60** `[todo]` **첫 번째 부모만 따라가기** 옵션이 있으며 기본은 꺼짐이다. 켜면 병합된 사이드 브랜치의 커밋들이 목록에서 빠지고 그래프가 단순해진다.
- **G-61** `[skip]` reflog가 참조하는 커밋까지 그래프에 포함하는 옵션. (원본: `includeCommitsMentionedByReflogs`)
- **G-62** `[todo]` 정렬 옵션을 바꾸면 그래프 전체가 다시 로드되어(초기 N개부터) 새 순서로 렌더링된다.

(출처: 위키 Extension Settings)

---

## 9. 키보드 단축키

- **G-63** `[todo]` `CTRL/CMD + F` — 검색 위젯 열기
- **G-64** `[todo]` `CTRL/CMD + R` — 그래프 새로고침
- **G-65** `[skip]` `CTRL/CMD + H` — HEAD 커밋으로 스크롤/센터링
- **G-66** `[skip]` `CTRL/CMD + S` / `CTRL/CMD + SHIFT + S` — 다음/이전 스태시로 스크롤 (스태시 표시 자체가 MVP 제외)
- **G-67** `[skip]` 단축키 키 조합을 설정으로 재지정하는 기능. (원본: `keyboardShortcut.*`)

(출처: 마켓플레이스 페이지, 원본 package.json contributes.configuration)

---

## 10. 접근성

- **G-68** `[changed]` 파일 변경 종류를 색상뿐 아니라 **문자 표식(A / M / D / R / U)** 으로도 표시한다. 원본은 옵션(기본 꺼짐)이지만 GitScope는 **항상 켜짐**으로 둔다.

(출처: README, 위키 Extension Settings)

---

## 11. 확인 필요 (미확정)

원본을 직접 실행해 블랙박스 관찰로 채워야 하는 항목. 위키·README에 문서화되어 있지 않다.

- 레인 배치 알고리즘의 구체적 관찰 결과(새 분기가 왼쪽/오른쪽 중 어느 방향으로 열리는지, 레인 회수 시점)
- 색상 팔레트가 레인 인덱스 기준으로 순환하는지, 브랜치 식별자 기준인지
- 컬럼 너비·표시 상태가 리포별로 유지되는지, 전역으로 유지되는지
- 검색 위젯의 매칭 규칙(부분 일치 / 대소문자 구분 / 여러 건 순회 방식)

> 위 항목은 관찰 후 이 문서에 반영한다. **원본 소스 코드는 열지 않는다.**

---

## 항목 집계

| 태그 | 개수 |
|---|---|
| `[todo]` | 39 |
| `[skip]` | 23 |
| `[changed]` | 6 |
| **합계** | **68** |
