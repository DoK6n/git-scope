# 50. 설정 (Settings)

원본(Git Graph)의 설정 인벤토리를 사실 기준으로 정리하고, GitScope에서 구현할 항목을 선별한 문서.

**출처**
- (출처: 위키 Extension Settings) — 카테고리 구조, 설정 간 의존 관계
- (출처: contributes.configuration) — 로컬 `vscode-git-graph/package.json`의 설정 키·타입·기본값·enum 목록

**클린룸 준수**: 원본 소스 코드는 참조하지 않았다. 설정의 "효과" 서술은 키 이름·타입·기본값·enum이라는 사실 데이터에서 재기술한 것이며 원본 문장을 옮기지 않았다.

## 인벤토리 요약

| 구분 | 개수 |
|---|---|
| 현행 설정 (deprecated 제외) | 81 |
| deprecated 설정 (구 평면 키) | 29 |
| **원본 설정 총계** | **110** |
| GitScope [todo] | 22 |
| GitScope [skip] | 59 (현행 81 중) + 29 (deprecated 전부) |
| GitScope 신규 설정 [new] | 6 |

**상태 태그**
- `[todo]` — 1차 구현 대상
- `[skip]` — 구현하지 않음 (필요해지면 재검토)
- `[new]` — 원본에 없는 GitScope 신규 설정

**네임스페이스**: 원본 `git-graph.*` → GitScope `gitScope.*`. 계층 구조(`repository.commits.*` 등)는 VS Code 설정 UI에서 그룹핑이 자동으로 되므로 동일한 도트 계층 방식을 따른다.

---

## 1차 구현 대상 ([todo] 22개)

### 1.1 그래프 표시

| 키 | 타입 | 기본값 | 효과 |
|---|---|---|---|
| `gitScope.graph.colours` | array\<string> | 12색 팔레트 | 그래프 브랜치 선/노드에 순환 적용할 색상 배열. 원본 기본값은 `#0085d9`, `#d9008f`, `#00d90a`, `#d98500`, `#a300d9`, `#ff0000`, `#00d9cc`, `#e138e8`, `#85d900`, `#dc5b23`, `#6f24d6`, `#ffcc00` 12개 (출처: contributes.configuration). GitScope는 자체 팔레트를 기본값으로 쓰되 배열 구조는 동일 |
| `gitScope.graph.style` | enum | `rounded` | 브랜치 분기/병합 지점의 선 형태. `rounded`(곡선) / `angular`(직각) |
| `gitScope.defaultColumnVisibility` | object | `{"Date":true,"Author":true,"Commit":true}` | 그래프 테이블의 Date/Author/Commit 컬럼 초기 표시 여부. 뷰에서 사용자가 바꾼 값은 리포별로 별도 저장 |
| `gitScope.date.format` | enum | `Date & Time` | Date 컬럼 렌더 형식. `Date & Time` / `Date Only` / `ISO Date & Time` / `ISO Date Only` / `Relative` |
| `gitScope.date.type` | enum | `Author Date` | Date 컬럼에 author date와 commit date 중 무엇을 쓸지 결정. git log의 `%at` / `%ct` 선택에 대응 |

### 1.2 커밋 로딩

| 키 | 타입 | 기본값 | 효과 |
|---|---|---|---|
| `gitScope.repository.commits.initialLoad` | number | `300` | 리포를 열 때 처음 읽어올 커밋 수. `git log -n <N>` 인자에 대응 |
| `gitScope.repository.commits.loadMore` | number | `100` | "더 불러오기" 1회당 추가로 읽을 커밋 수 |
| `gitScope.repository.commits.loadMoreAutomatically` | boolean | `true` | 스크롤이 바닥에 닿으면 버튼 없이 자동으로 다음 묶음을 로드 |
| `gitScope.repository.commits.order` | enum | `date` | 커밋 정렬 방식. `date` / `author-date` / `topo` — git log의 `--date-order` / `--author-date-order` / `--topo-order`에 대응. 뷰에서 리포별 재정의 가능 (출처: 위키 Extension Settings) |

### 1.3 리포지토리 표시 범위

| 키 | 타입 | 기본값 | 효과 |
|---|---|---|---|
| `gitScope.repository.showRemoteBranches` | boolean | `true` | 원격 추적 브랜치를 그래프 대상에 포함할지 기본값. 리포별 재정의 가능 |
| `gitScope.repository.showTags` | boolean | `true` | 태그 참조 라벨 표시 여부 기본값 |
| `gitScope.repository.showUncommittedChanges` | boolean | `true` | 커밋되지 않은 변경을 그래프 최상단 가상 노드로 표시. 끄면 `git status` 호출을 생략하므로 대형 리포에서 초기 로드가 빨라짐 |
| `gitScope.repository.onLoad.showCheckedOutBranch` | boolean | `false` | 리포를 열었을 때 전체 브랜치 대신 체크아웃된 브랜치만 보여줄지. `false`면 전체 브랜치 |
| `gitScope.customBranchGlobPatterns` | array\<{name, glob}> | `[]` | 브랜치 드롭다운에 사용자 정의 glob 필터 항목을 추가. 예: `[{"name":"Feature","glob":"heads/feature/*"}]`. GitScope 필수 신규 기능 "glob 패턴 검색 필터"의 기반 설정 |

### 1.4 Fetch / Prune

| 키 | 타입 | 기본값 | 효과 |
|---|---|---|---|
| `gitScope.repository.fetchAndPrune` | boolean | `false` | 컨트롤바 Fetch 실행 시 `--prune`을 함께 적용해, 원격에서 사라진 원격 추적 참조를 정리. GitScope 필수 신규 기능 4 |
| `gitScope.repository.fetchAndPruneTags` | boolean | `false` | Fetch 시 원격에 없는 로컬 태그도 정리(`--prune-tags`). Git ≥ 2.17 필요하며 `fetchAndPrune`이 켜져 있어야 동작. 다중 remote 리포에서는 의도치 않은 태그 삭제 위험이 있음 (출처: 위키 Extension Settings) |

### 1.5 액션(다이얼로그) 기본값

| 키 | 타입 | 기본값 | 효과 |
|---|---|---|---|
| `gitScope.dialog.resetCurrentBranchToCommit.mode` | enum | `Mixed` | 커밋으로 리셋 다이얼로그의 기본 모드. `Soft` / `Mixed` / `Hard`. GitScope 필수 신규 기능 1(git reset)의 기본값 |
| `gitScope.dialog.resetUncommittedChanges.mode` | enum | `Mixed` | 미커밋 변경 리셋 다이얼로그의 기본 모드. `Mixed` / `Hard` (Soft 없음) |
| `gitScope.dialog.createBranch.checkOut` | boolean | `false` | 브랜치 생성 다이얼로그의 "생성 후 체크아웃" 체크박스 초기 상태 |
| `gitScope.dialog.merge.noFastForward` | boolean | `true` | 머지 다이얼로그의 `--no-ff` 체크박스 초기 상태 |
| `gitScope.dialog.fetchRemote.prune` | boolean | `false` | 원격 Fetch 다이얼로그의 Prune 체크박스 초기 상태 |
| `gitScope.dialog.fetchRemote.pruneTags` | boolean | `false` | 원격 Fetch 다이얼로그의 Prune Tags 체크박스 초기 상태 |

---

## 2. GitScope 신규 설정 ([new])

원본에 대응 항목이 없으며, GitScope 필수 신규 기능을 위해 새로 정의한다.

| 키 | 타입 | 기본값 | 효과 | 상태 |
|---|---|---|---|---|
| `gitScope.branches.sortOrder` | enum | `committerdate` | 브랜치 드롭다운/라벨 정렬 기준. `committerdate`(최근 커밋 순) / `alphabetical` / `refname`. 원본은 정렬 설정을 노출하지 않음 | [new] |
| `gitScope.worktree.show` | boolean | `true` | 다른 worktree가 체크아웃한 브랜치를 그래프에 별도 마커로 표시 | [new] |
| `gitScope.worktree.showInRepoDropdown` | boolean | `true` | 리포 드롭다운에 linked worktree를 하위 항목으로 노출 | [new] |
| `gitScope.search.globPattern` | boolean | `true` | 검색 위젯 입력을 glob 패턴으로 해석 (브랜치명·커밋 메시지 대상) | [new] |
| `gitScope.search.caseSensitive` | boolean | `false` | 검색 대소문자 구분 기본값 | [new] |
| `gitScope.dialog.reset.defaultTarget` | string | `HEAD~1` | reset 다이얼로그의 `HEAD~N` 입력 초기값 | [new] |

---

## 3. 원본 설정 전체 인벤토리

### 3.1 커밋 상세 뷰 (Commit Details View)

| 원본 키 → `gitScope.*` | 타입 | 기본값 | 효과 | 상태 |
|---|---|---|---|---|
| `commitDetailsView.autoCenter` | boolean | `true` | 상세 뷰가 열릴 때 해당 커밋 행이 화면 중앙에 오도록 스크롤 | [skip] |
| `commitDetailsView.location` | enum | `Inline` | 상세 뷰 배치. `Inline`(커밋 행 아래 인라인) / `Docked to Bottom`(하단 고정) | [skip] |
| `commitDetailsView.fileView.type` | enum | `File Tree` | 변경 파일 목록의 기본 표현. `File Tree` / `File List`. 뷰에서 리포별 재정의 가능 | [skip] |
| `commitDetailsView.fileView.fileTree.compactFolders` | boolean | `true` | 자식이 하나뿐인 폴더 체인을 한 줄로 압축해 표시 | [skip] |

### 3.2 그래프 표시

| 원본 키 → `gitScope.*` | 타입 | 기본값 | 효과 | 상태 |
|---|---|---|---|---|
| `graph.colours` | array | 12색 | 브랜치 색상 팔레트 | **[todo]** |
| `graph.style` | enum | `rounded` | 선 스타일 `rounded` / `angular` | **[todo]** |
| `graph.uncommittedChanges` | enum | `Open Circle at the Uncommitted Changes` | 미커밋 변경 노드의 빈 원을 미커밋 노드에 둘지, 체크아웃된 커밋에 둘지 | [skip] |
| `defaultColumnVisibility` | object | `{Date,Author,Commit: true}` | 컬럼 초기 표시 | **[todo]** |
| `date.format` | enum | `Date & Time` | 날짜 형식 5종 | **[todo]** |
| `date.type` | enum | `Author Date` | author / commit date 선택 | **[todo]** |
| `referenceLabels.alignment` | enum | `Normal` | 참조 라벨 정렬. `Normal` / 브랜치 왼쪽·태그 오른쪽 / 브랜치 그래프정렬·태그 오른쪽 | [skip] |
| `referenceLabels.combineLocalAndRemoteBranchLabels` | boolean | `true` | 같은 커밋의 동명 로컬/원격 브랜치 라벨을 하나로 합침 | [skip] |
| `markdown` | boolean | `true` | 커밋 메시지·태그 상세의 인라인 마크다운(굵게/기울임/인라인 코드) 렌더 | [skip] |
| `customEmojiShortcodeMappings` | array | `[]` | `:shortcode:` → 이모지 치환 매핑 추가 | [skip] |
| `enhancedAccessibility` | boolean | `false` | 색상에만 의존하지 않도록 파일 변경 종류를 A/M/D/R/U 문자로 병기 | [skip] |
| `tabIconColourTheme` | enum | `colour` | 탭 아이콘 색상 테마 `colour` / `grey` | [skip] |

### 3.3 커밋 로딩 / 리포지토리 동작

| 원본 키 → `gitScope.*` | 타입 | 기본값 | 효과 | 상태 |
|---|---|---|---|---|
| `repository.commits.initialLoad` | number | `300` | 초기 로드 커밋 수 | **[todo]** |
| `repository.commits.loadMore` | number | `100` | 추가 로드 커밋 수 | **[todo]** |
| `repository.commits.loadMoreAutomatically` | boolean | `true` | 스크롤 하단 도달 시 자동 추가 로드 | **[todo]** |
| `repository.commits.order` | enum | `date` | `date` / `author-date` / `topo` | **[todo]** |
| `repository.commits.fetchAvatars` | boolean | `false` | 작성자 아바타를 GitHub/GitLab/Gravatar에서 조회 (이메일이 외부로 전송됨) | [skip] |
| `repository.commits.showSignatureStatus` | boolean | `false` | 서명된 커밋의 GPG 서명 검증 상태 표시. Git ≥ 2.4 + GPG 필요 | [skip] |
| `repository.commits.mute.mergeCommits` | boolean | `true` | 머지 커밋을 흐린 색으로 표시 | [skip] |
| `repository.commits.mute.commitsThatAreNotAncestorsOfHead` | boolean | `false` | HEAD의 조상이 아닌 커밋을 흐린 색으로 표시 | [skip] |
| `repository.onlyFollowFirstParent` | boolean | `false` | `--first-parent`로 첫 부모만 따라가며 커밋 수집 | [skip] |
| `repository.includeCommitsMentionedByReflogs` | boolean | `false` | reflog에만 남은 커밋 포함 (전체 브랜치 표시 시에만 적용) | [skip] |
| `repository.showCommitsOnlyReferencedByTags` | boolean | `true` | 태그로만 참조되는 커밋 포함 | [skip] |
| `repository.showRemoteBranches` | boolean | `true` | 원격 브랜치 표시 | **[todo]** |
| `repository.showRemoteHeads` | boolean | `true` | `origin/HEAD` 같은 원격 심볼릭 참조 표시 | [skip] |
| `repository.showTags` | boolean | `true` | 태그 표시 | **[todo]** |
| `repository.showStashes` | boolean | `true` | 스태시를 그래프 노드로 표시 | [skip] |
| `repository.showUncommittedChanges` | boolean | `true` | 미커밋 변경 노드 표시 | **[todo]** |
| `repository.showUntrackedFiles` | boolean | `true` | 미커밋 변경 상세에 untracked 파일 포함 | [skip] |
| `repository.onLoad.showCheckedOutBranch` | boolean | `false` | 로드 시 체크아웃 브랜치만 표시 | **[todo]** |
| `repository.onLoad.showSpecificBranches` | array | `[]` | 로드 시 표시할 브랜치 지정. 로컬명 / `remotes/` 접두 / `--glob=` 접두 형식 지원 | [skip] |
| `repository.onLoad.scrollToHead` | boolean | `false` | 로드 후 HEAD 커밋으로 스크롤 (로드된 범위 안에 있을 때만) | [skip] |
| `repository.fetchAndPrune` | boolean | `false` | Fetch 시 prune 동반 | **[todo]** |
| `repository.fetchAndPruneTags` | boolean | `false` | Fetch 시 태그 prune 동반 | **[todo]** |
| `repository.useMailmap` | boolean | `false` | `.mailmap`을 반영해 작성자명/이메일 표시 | [skip] |
| `repository.sign.commits` | boolean | `false` | 커밋 생성 시 GPG/X.509 서명 | [skip] |
| `repository.sign.tags` | boolean | `false` | 태그 생성 시 GPG/X.509 서명 | [skip] |
| `customBranchGlobPatterns` | array | `[]` | 브랜치 드롭다운용 glob 프리셋 | **[todo]** |

### 3.4 액션(다이얼로그) 기본값

원본은 각 다이얼로그의 체크박스/모드 초기 상태를 개별 설정으로 노출한다 (출처: contributes.configuration). GitScope는 reset·merge·fetch·createBranch 관련만 1차 구현한다.

| 원본 키 → `gitScope.*` | 타입 | 기본값 | 효과 | 상태 |
|---|---|---|---|---|
| `dialog.resetCurrentBranchToCommit.mode` | enum | `Mixed` | Soft/Mixed/Hard | **[todo]** |
| `dialog.resetUncommittedChanges.mode` | enum | `Mixed` | Mixed/Hard | **[todo]** |
| `dialog.createBranch.checkOut` | boolean | `false` | 생성 후 체크아웃 | **[todo]** |
| `dialog.merge.noFastForward` | boolean | `true` | `--no-ff` | **[todo]** |
| `dialog.fetchRemote.prune` | boolean | `false` | `--prune` | **[todo]** |
| `dialog.fetchRemote.pruneTags` | boolean | `false` | `--prune-tags` | **[todo]** |
| `dialog.addTag.type` | enum | `Annotated` | `Annotated` / `Lightweight` | [skip] |
| `dialog.addTag.pushToRemote` | boolean | `false` | 태그 생성 직후 원격 push | [skip] |
| `dialog.applyStash.reinstateIndex` | boolean | `false` | stash apply 시 `--index` | [skip] |
| `dialog.popStash.reinstateIndex` | boolean | `false` | stash pop 시 `--index` | [skip] |
| `dialog.stashUncommittedChanges.includeUntracked` | boolean | `true` | stash 시 `--include-untracked` | [skip] |
| `dialog.cherryPick.noCommit` | boolean | `false` | `--no-commit` | [skip] |
| `dialog.cherryPick.recordOrigin` | boolean | `false` | `-x` (원본 커밋 해시 기록) | [skip] |
| `dialog.deleteBranch.forceDelete` | boolean | `false` | `-D` 강제 삭제 | [skip] |
| `dialog.fetchIntoLocalBranch.forceFetch` | boolean | `false` | 강제 fetch | [skip] |
| `dialog.merge.noCommit` | boolean | `false` | `--no-commit` | [skip] |
| `dialog.merge.squashCommits` | boolean | `false` | `--squash` | [skip] |
| `dialog.merge.squashMessageFormat` | enum | `Default` | squash 커밋 메시지 형식. `Default` / `Git SQUASH_MSG` | [skip] |
| `dialog.pullBranch.noFastForward` | boolean | `false` | pull 시 `--no-ff` | [skip] |
| `dialog.pullBranch.squashCommits` | boolean | `false` | pull 시 `--squash` | [skip] |
| `dialog.pullBranch.squashMessageFormat` | enum | `Default` | pull squash 메시지 형식 | [skip] |
| `dialog.rebase.ignoreDate` | boolean | `true` | 비대화식 rebase의 `--ignore-date` | [skip] |
| `dialog.rebase.launchInteractiveRebase` | boolean | `false` | 새 터미널에서 대화식 rebase 실행 | [skip] |
| `dialog.general.referenceInputSpaceSubstitution` | enum | `None` | 참조명 입력에서 공백 자동 치환. `None` / `Hyphen` / `Underscore` | [skip] |

### 3.5 UI / 통합 / 리포 관리

| 원본 키 → `gitScope.*` | 타입 | 기본값 | 효과 | 상태 |
|---|---|---|---|---|
| `maxDepthOfRepoSearch` | number | `0` | 워크스페이스에서 리포를 탐색할 하위 폴더 최대 깊이. 0이면 워크스페이스 루트만. 하위 폴더 탐색 시에도 sub-repo는 자동 감지되지 않음 (출처: 위키 Extension Settings) | [skip] |
| `repositoryDropdownOrder` | enum | `Workspace Full Path` | 리포 드롭다운 정렬 기준. `Full Path` / `Name` / `Workspace Full Path` | [skip] |
| `openToTheRepoOfTheActiveTextEditorDocument` | boolean | `false` | 뷰를 열 때 현재 활성 편집기 문서가 속한 리포를 선택 | [skip] |
| `openNewTabEditorGroup` | enum | `Active` | Diff 뷰/파일 열기 시 사용할 편집기 그룹. `Active` / `Beside` / `One`~`Nine` | [skip] |
| `retainContextWhenHidden` | boolean | `true` | 탭이 백그라운드로 가도 웹뷰 컨텍스트 유지. 재진입이 빠른 대신 메모리 사용 증가 | [skip] |
| `showStatusBarItem` | boolean | `true` | 상태 표시줄 왼쪽 영역에 `Git Graph` 뷰 열기 항목 노출 | [done] |
| `sourceCodeProviderIntegrationLocation` | enum | `Inline` | SCM 제공자 타이틀에 액션을 인라인으로 둘지 More Actions 메뉴에 둘지 | [skip] |
| `contextMenuActionsVisibility` | object | `{}` | 컨텍스트 메뉴 항목별 표시 여부를 중첩 객체로 제어. 예: `{"branch":{"rebase":false}}` | [skip] |
| `keyboardShortcut.find` | enum | `CTRL/CMD + F` | 찾기 위젯 단축키 (UNASSIGNED + A~Z 조합 중 선택) | [skip] |
| `keyboardShortcut.refresh` | enum | `CTRL/CMD + R` | 새로고침 단축키 | [skip] |
| `keyboardShortcut.scrollToHead` | enum | `CTRL/CMD + H` | HEAD 커밋으로 스크롤 | [skip] |
| `keyboardShortcut.scrollToStash` | enum | `CTRL/CMD + S` | 다음 스태시로 스크롤 (Shift 조합 시 이전 스태시) | [skip] |
| `integratedTerminalShell` | string | `""` | 확장이 통합 터미널을 열 때 사용할 셸 실행 파일 경로. 비우면 기본 셸 | [skip] |
| `fileEncoding` | string | `utf8` | 특정 리비전의 파일 내용을 읽을 때 사용할 문자 인코딩 | [skip] |
| `customPullRequestProviders` | array | `[]` | PR 생성 통합에서 사용할 사용자 정의 제공자 목록 | [skip] |

### 3.6 외부 설정 소비

| 키 | 설명 | 상태 |
|---|---|---|
| `git.path` | VS Code 내장 Git 확장의 설정. 원본은 이 값을 읽어 git 실행 파일 경로를 결정한다 (출처: 위키 Extension Settings) | **[todo]** 준함 — GitScope도 `git.path`를 우선 참조하고, 없으면 PATH의 `git` 사용. 별도 `gitScope.*` 키를 만들지 않음 |

> `git.path`는 GitScope 자체 설정이 아니므로 위 인벤토리 개수에는 포함하지 않는다.

### 3.7 Deprecated 설정 (29개, 전부 [skip])

원본은 계층형 키로 전환하면서 구 평면 키 29개를 deprecated 상태로 남겨 두었다 (출처: contributes.configuration). GitScope는 하위 호환 대상이 없으므로 전부 구현하지 않는다.

`autoCenterCommitDetailsView`, `combineLocalAndRemoteBranchLabels`, `commitDetailsViewFileTreeCompactFolders`, `commitDetailsViewLocation`, `commitOrdering`, `dateFormat`, `dateType`, `defaultFileViewType`, `fetchAndPrune`, `fetchAvatars`, `graphColours`, `graphStyle`, `includeCommitsMentionedByReflogs`, `initialLoadCommits`, `loadMoreCommits`, `loadMoreCommitsAutomatically`, `muteCommitsThatAreNotAncestorsOfHead`, `muteMergeCommits`, `onlyFollowFirstParent`, `openDiffTabLocation`, `openRepoToHead`, `referenceLabelAlignment`, `showCommitsOnlyReferencedByTags`, `showCurrentBranchByDefault`, `showSignatureStatus`, `showTags`, `showUncommittedChanges`, `showUntrackedFiles`, `useMailmap`

---

## 4. 구현 노트

1. **설정 키 네이밍**: 처음부터 계층형(`gitScope.repository.commits.initialLoad`)으로 정의한다. 원본이 겪은 평면 → 계층 마이그레이션을 반복하지 않는다.
2. **리포별 재정의**: `commits.order`, `showRemoteBranches`, `showTags`, `defaultColumnVisibility`는 원본에서 워크스페이스 설정이 "기본값"이고 뷰에서 리포 단위로 덮어쓸 수 있다 (출처: 위키 Extension Settings). GitScope도 동일하게 `workspaceState` 기반 리포별 오버라이드 계층을 둔다.
3. **의존 관계**: `fetchAndPruneTags`는 `fetchAndPrune`이 켜져 있을 때만 유효하다. 설정 읽기 계층에서 이 제약을 강제한다.
4. **[skip] 재검토 트리거**: 아바타·서명 검증·PR 제공자·컨텍스트 메뉴 가시성은 각각 외부 네트워크, GPG 의존, 통합 기능이 필요하다. MVP 이후 해당 기능을 구현할 때 함께 되살린다.
