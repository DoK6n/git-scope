# 40. 상세 뷰 · 비교 뷰

커밋을 클릭했을 때 열리는 상세 영역, 두 커밋 사이의 비교 영역, uncommitted changes 표시, 그리고 그 안의 파일 액션.

**상태 태그**: `[todo]` 구현 예정 · `[wip]` 진행 중 · `[done]` 완료 · `[skip]` 구현 안 함 · `[changed]` 원본과 다르게 감

---

## 40.1 커밋 상세 뷰 (Commit Details View)

### 40.1.1 열기 / 닫기 [todo]

- 그래프의 커밋 행을 **클릭**하면 상세 뷰가 열린다. (출처: README — "View commit details and file changes by clicking on a commit")
- 같은 커밋을 다시 클릭하거나 `Escape`를 누르면 닫힌다. `Escape`는 활성 다이얼로그·컨텍스트 메뉴·상세 뷰를 닫는 공통 키다. (출처: README Keyboard Shortcuts)
- 열릴 때 해당 커밋이 화면 중앙에 오도록 자동 스크롤한다. 원본은 `commitDetailsView.autoCenter`(기본 `true`)로 이 동작을 켜고 끈다. (출처: 위키 Extension Settings / 원본 package.json)

### 40.1.2 배치 위치 [todo]

두 가지 배치를 지원한다. 원본 설정 키는 `commitDetailsView.location`, 기본값 `Inline`. (출처: 위키 Extension Settings / 원본 package.json)

| 값 | 동작 |
|---|---|
| `Inline` | 클릭한 커밋 행 바로 아래가 펼쳐지며, 그래프·커밋 목록 사이에 끼어든다 |
| `Docked to Bottom` | 그래프 뷰 하단에 고정된 패널로 표시된다 |

- GitScope에서는 `gitScope.commitDetailsView.location`으로 재명명한다. 상세는 `50-settings.md`.

### 40.1.3 표시되는 메타데이터 [todo]

상세 뷰 상단에 커밋 메타데이터를 표시한다.

| 항목 | 비고 | 출처 |
|---|---|---|
| 커밋 해시 | 전체 해시 | 요구사항 (블랙박스 관찰로 형식 확정 필요) |
| 부모 커밋 | 머지 커밋은 2개 이상. 각 부모는 클릭 가능한 참조로 표시 | 요구사항 |
| 작성자 (Author) | 이름 + 이메일 + 작성 일시 | 요구사항 / `date.type`에 `Author Date` 존재 (원본 package.json) |
| 커밋터 (Committer) | 이름 + 이메일 + 커밋 일시 | 원본 package.json — `repository.commits.showSignatureStatus`가 "커밋터 오른쪽에 서명 상태 표시"라고 명시하므로 커밋터 필드가 존재함이 확인됨 |
| 커밋 본문 (body) | 제목 아래 전문 | README — 본문 내 URL 클릭 가능 언급으로 본문 표시 확인됨 |
| 서명 상태 | 서명된 커밋에 한해 커밋터 오른쪽에 아이콘. 호버 시 서명 상세 툴팁. Git ≥ 2.4.0 및 GPG 필요 | 원본 package.json `repository.commits.showSignatureStatus` (기본 `false`) — `[skip]` |

- 부가 렌더링 동작:
  - 커밋 본문 안의 HTTP/HTTPS URL을 클릭하면 기본 브라우저로 열린다. (출처: README) `[todo]`
  - 커밋 메시지·태그 상세에서 인라인 마크다운 일부(굵게, 기울임, 굵은 기울임, 인라인 코드)를 렌더링한다. 원본 설정 `markdown`, 기본 `true`. (출처: 원본 package.json) `[skip]`
  - 이모지 shortcode를 대응 이모지로 치환한다(gitmoji 포함). 사용자 정의 매핑은 `customEmojiShortcodeMappings`. (출처: README / 원본 package.json) `[skip]`
  - 작성자·커밋터 아바타를 외부(GitHub / GitLab / Gravatar)에서 가져온다. 원본 설정 `repository.commits.fetchAvatars`, 기본 `false` — 활성화 시 이메일이 외부로 전송된다는 동의 문구가 붙어 있다. (출처: 원본 package.json) `[skip]` — 프라이버시 부담 대비 이득이 작음
  - `.mailmap`을 존중해 이름·이메일을 표시한다. 원본 설정 `repository.useMailmap`, 기본 `false`. (출처: 원본 package.json) `[skip]`

### 40.1.4 변경 파일 목록 [todo]

- 메타데이터 아래에 해당 커밋이 변경한 파일들이 표시된다. (출처: README — "View commit details and file changes")
- 두 가지 표현 방식을 지원하며, 상세 뷰 우측 컨트롤로 전환한다. 원본 설정 키 `commitDetailsView.fileView.type`, 기본 `File Tree`. (출처: 위키 Extension Settings / 원본 package.json)

| 값 | 동작 |
|---|---|
| `File Tree` | 디렉토리 계층 구조로 표시 |
| `File List` | 평평한 경로 목록으로 표시 (폴더가 깊은 리포지토리에 유용) |

- 전환한 값은 **리포지토리별로 유지**된다. 전역 설정은 기본값 역할만 한다. (출처: 원본 package.json — "This can be overridden per repository using the controls on the right side of the Commit Details View")
- 트리 모드에서 자식 폴더가 하나뿐인 폴더 체인을 하나의 항목으로 압축해 표시한다(compact folders). 원본 설정 `commitDetailsView.fileView.fileTree.compactFolders`, 기본 `true`. (출처: 위키 Extension Settings / 원본 package.json) `[todo]`
- 각 파일의 변경 종류(추가/수정/삭제/이름변경/충돌)를 색으로 구분한다. 색각 이상 사용자를 위해 `A|M|D|R|U` 문자 인디케이터를 추가로 표시하는 옵션이 있다. 원본 설정 `enhancedAccessibility`, 기본 `false`. (출처: 위키 Extension Settings / 원본 package.json) `[todo]` — GitScope는 문자 인디케이터를 **기본 활성**으로 검토 `[changed]`

### 40.1.5 키보드 내비게이션 [todo]

상세 뷰가 열려 있을 때만 동작한다. (출처: README Keyboard Shortcuts)

| 키 | 동작 |
|---|---|
| `Up` / `Down` | 그래프 상에서 바로 위/아래에 있는 커밋으로 상세 뷰를 이동 |
| `Ctrl/Cmd + Up` / `Ctrl/Cmd + Down` | 같은 브랜치 상의 자식/부모 커밋으로 이동 |
| `Ctrl/Cmd + Shift + Up` / `Ctrl/Cmd + Shift + Down` | 위와 같되, 분기·머지를 만나면 대체 브랜치를 따라간다 |
| `Escape` | 상세 뷰를 닫는다 |

---

## 40.2 파일 액션

### 40.2.1 파일 클릭 → 디프 열기 [todo]

- 상세 뷰의 파일을 **클릭**하면 VS Code 디프 뷰가 새 탭으로 열린다. 좌: 해당 커밋의 부모 버전, 우: 해당 커밋 버전. (출처: README — "View the Visual Studio Code Diff of any file change by clicking on it")
- 디프 탭이 열리는 에디터 그룹은 설정으로 지정한다. 원본 키 `openNewTabEditorGroup`, 값은 `Active` / `Beside` / `One`~`Nine`, 기본 `Active`. 이 설정은 디프 뷰뿐 아니라 파일 열기·특정 리비전 파일 보기에도 함께 적용된다. (출처: 위키 Extension Settings / 원본 package.json)
- 특정 리비전의 파일 내용을 읽을 때 사용할 문자 인코딩을 지정할 수 있다. 원본 키 `fileEncoding`, 기본 `utf8`, 스코프 `resource`. (출처: 원본 package.json) `[todo]`

### 40.2.2 파일 컨텍스트 메뉴 [todo]

파일 항목을 우클릭하면 아래 액션이 나온다. (출처: 위키 Context Menus / 원본 package.json `contextMenuActionsVisibility.commitDetailsViewFile`)

| 액션(원본 라벨) | 동작 | 상태 |
|---|---|---|
| View Diff | 해당 커밋의 변경분 디프를 연다 (파일 클릭과 동일) | [todo] |
| View File at this Revision | 해당 커밋 시점의 파일 내용을 읽기 전용으로 연다 | [todo] |
| View Diff with Working File | 해당 커밋 버전과 **현재 워킹 트리 파일**을 비교하는 디프를 연다 | [todo] |
| Open File | 워킹 트리의 현재 버전 파일을 에디터에서 연다 | [todo] |
| Copy Absolute File Path to Clipboard | 절대 경로를 클립보드에 복사 | [todo] |
| Copy Relative File Path to Clipboard | 리포지토리 루트 기준 상대 경로를 클립보드에 복사 | [todo] |
| Reset File to this Revision... | 해당 파일을 그 커밋 시점 내용으로 되돌린다. 확인 다이얼로그 동반 | [todo] |
| Mark as Reviewed | 코드 리뷰 추적에서 해당 파일을 검토 완료로 표시 | [skip] |
| Mark as Not Reviewed | 검토 미완료로 되돌림 | [skip] |

- 각 액션의 노출 여부는 설정 객체로 개별 제어된다. 원본 키 `contextMenuActionsVisibility`. 예를 들어 `{ "commitDetailsViewFile": { "resetFileToThisRevision": false } }`처럼 끌 수 있다. (출처: 원본 package.json)
- 디프 에디터가 열려 있을 때 에디터 타이틀 바에 "Open File" 아이콘 액션이 추가된다. 원본은 `isInDiffEditor && resourceScheme == git-graph` 조건에서 노출한다. GitScope는 스킴을 `git-scope`로 쓴다. (출처: 원본 package.json `contributes.menus.editor/title`) `[todo]`

### 40.2.3 코드 리뷰 추적 [skip]

- 원본은 커밋 하나 또는 두 커밋 사이에 대해 "코드 리뷰"를 시작할 수 있다. 리뷰를 시작하면 검토 대상 파일이 굵게 표시되고, 디프를 보거나 파일을 열면 굵기가 해제된다. 리뷰 상태는 VS Code 세션을 넘어 유지되며 90일간 활동이 없으면 자동 종료된다. uncommitted changes에는 적용되지 않는다. (출처: README — Code Review)
- 관련 커맨드: `End All Code Reviews in Workspace`, `End a specific Code Review in Workspace...`, `Resume a specific Code Review in Workspace...`. (출처: 원본 package.json `contributes.commands`)
- **GitScope 초기 릴리즈에서는 구현하지 않는다.** 영속 상태 관리 비용이 크고, 핵심 가치(그래프 + 액션)와 거리가 있다.

---

## 40.3 커밋 간 비교 뷰 (Commit Comparison View) [todo] (M5)

### 40.3.1 두 커밋 선택 [todo] (M5)

- 커밋 하나를 클릭한 뒤, 다른 커밋을 `Ctrl/Cmd + 클릭`하면 비교 뷰로 전환된다. (출처: README — "Compare any two commits by clicking on a commit, and then CTRL/CMD clicking on another")
- 선택된 두 커밋은 그래프에서 모두 선택 상태로 강조된다.
- 선택을 해제하거나 `Escape`를 누르면 비교 뷰가 닫히고 원래 상태로 돌아간다.

### 40.3.2 비교 결과 표시 [todo] (M5)

- 두 커밋 **사이에서** 변경된 파일 목록을 표시한다. (출처: README)
- 파일 목록의 표현 방식(File Tree / File List)과 compact folders 동작은 커밋 상세 뷰와 동일한 설정을 공유한다. 원본의 구 설정 이름이 "Commit Details / Comparison Views"로 두 뷰를 함께 지칭한다. (출처: 원본 package.json — deprecated `commitDetailsViewFileTreeCompactFolders` / `defaultFileViewType` 설명)
- 커밋 상세 뷰와 달리 단일 커밋의 메타데이터(작성자·커밋터·본문)는 표시하지 않는다. 대신 비교 기준이 되는 두 커밋을 식별할 수 있는 정보를 표시한다.

### 40.3.3 비교 뷰의 파일 액션 [todo] (M5)

- 파일 클릭 → 두 커밋 버전 간 VS Code 디프를 연다. (출처: README)
- 영향받은 파일의 **현재 버전**을 열 수 있다. (출처: README)
- 파일 경로를 클립보드에 복사할 수 있다. (출처: README)
- 컨텍스트 메뉴 구성은 40.2.2와 동일한 계열로 다룬다.

---

## 40.4 Uncommitted Changes 상세

### 40.4.1 그래프에서의 표현 [todo]

- 워킹 트리에 커밋되지 않은 변경이 있으면 그래프 최상단에 전용 행으로 표시된다. (출처: README — "View uncommitted changes")
- 표시 방식은 두 가지 중 선택한다. 원본 설정 `graph.uncommittedChanges`, 기본 `Open Circle at the Uncommitted Changes`. (출처: 위키 Extension Settings / 원본 package.json)

| 값 | 동작 |
|---|---|
| `Open Circle at the Uncommitted Changes` | uncommitted changes를 회색 빈 원으로 그리고, HEAD 커밋과 **실선** 회색 선으로 연결. 워킹 트리 상태가 항상 빈 원 |
| `Open Circle at the Checked Out Commit` | uncommitted changes를 회색 채운 원으로 그리고, HEAD 커밋과 **점선** 회색 선으로 연결. HEAD 커밋 쪽이 항상 빈 원 |

- 표시 자체를 끌 수 있다: `repository.showUncommittedChanges`(기본 `true`). 끄면 대형 리포지토리의 로드 시간이 줄어든다. (출처: 원본 package.json)

### 40.4.2 상세 표시 [todo]

- uncommitted changes 행을 클릭하면 커밋 상세 뷰와 같은 자리에 변경 파일 목록이 표시된다.
- 커밋이 아니므로 해시·부모·작성자·커밋터 같은 메타데이터는 없다. 파일 목록만 표시한다.
- 추적되지 않은 파일(untracked)의 포함 여부는 설정으로 정한다. 원본 키 `repository.showUntrackedFiles`, 기본 `true`. 끄면 로드 시간이 줄어든다. (출처: 위키 Extension Settings / 원본 package.json)
- 파일 클릭 시 워킹 트리 버전과 HEAD 버전의 디프가 열린다.
- 코드 리뷰 추적은 uncommitted changes에 적용되지 않는다. (출처: README)

### 40.4.3 임의 커밋과의 비교 [todo] (M5)

- uncommitted changes를 **임의의 커밋과 비교**할 수 있다. (출처: README — "compare the uncommitted changes with any commit")
- 선택 방식은 40.3.1과 동일하다: uncommitted changes 행을 클릭한 뒤 대상 커밋을 `Ctrl/Cmd + 클릭`.

### 40.4.4 uncommitted changes 컨텍스트 메뉴 [todo]

우클릭 시 아래 액션이 나온다. 액션 상세 명세는 `20-actions.md`. (출처: 위키 Context Menus / 원본 package.json `contextMenuActionsVisibility.uncommittedChanges`)

| 액션(원본 라벨) | 비고 |
|---|---|
| Stash uncommitted changes... | "Include Untracked" 체크박스 동반 (원본 기본 `true`) |
| Reset uncommitted changes... | 모드 선택: `Mixed` / `Hard` (원본 기본 `Mixed`) |
| Clean untracked files... | |
| Open Source Control View | VS Code 소스 제어 뷰로 이동 |

---

## 40.5 GitScope 확장 관점 메모

- **부모 커밋 내비게이션** — 원본은 상세 뷰에서 부모 해시를 보여주지만 클릭 이동 경로는 키보드 단축키 중심이다. GitScope는 부모/자식 해시를 클릭 가능한 링크로 만들어 마우스만으로도 이동 가능하게 한다. `[changed]`
- **reset 모드 UI** — uncommitted changes의 reset은 `Mixed` / `Hard`만 제공되지만, 커밋 대상 reset은 `Soft` / `Mixed` / `Hard`를 제공한다. GitScope는 여기에 `HEAD~N` 타겟 지정을 추가한다. 상세는 `60-new-features.md`.
- **worktree 표시** — 상세 뷰에서 해당 커밋이 어느 worktree에 체크아웃되어 있는지 표시한다. 상세는 `60-new-features.md`.

---

## 출처 요약

| 약칭 | 실제 출처 |
|---|---|
| README | https://raw.githubusercontent.com/mhutchie/vscode-git-graph/master/README.md |
| 마켓플레이스 | https://marketplace.visualstudio.com/items?itemName=mhutchie.git-graph |
| 위키 Extension Settings | https://github.com/mhutchie/vscode-git-graph/wiki/Extension-Settings |
| 위키 Context Menus | https://github.com/mhutchie/vscode-git-graph/wiki/Context-Menus |
| 원본 package.json | 로컬 `../vscode-git-graph/package.json`의 `contributes` 섹션 (클린룸 허용 범위) |

원본 구현 소스(`src/`, `web/`)는 참조하지 않았다. 위키의 "Codebase Outline" 페이지는 코드 구조 문서이므로 의도적으로 열지 않았다.
