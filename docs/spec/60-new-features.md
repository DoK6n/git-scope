# 60. 신규 기능 (원본에 없거나 부족한 것)

GitScope가 원본 Git Graph 대비 추가로 제공하는 신규 기능의 명세. 모두 GitScope 자체 설계이며 원본 관찰에서 유래하지 않는다.

## 1. git reset — 모드 선택 + 타겟 지정 `[done]`

원본은 커밋 우클릭 → reset 정도의 제한적 지원이었으나, GitScope는 모드와 타겟을 명시적으로 선택하는 UI를 제공한다.

### 동작

1. 커밋 우클릭 → **Reset current branch to this commit…** 선택
2. 다이얼로그 표시:
   - 모드 라디오 선택: `--soft` (인덱스·워킹트리 보존) / `--mixed` (기본값, 인덱스 리셋) / `--hard` (모두 폐기)
   - 각 모드 옆에 효과 한 줄 설명 표시
3. `--hard` 선택 시 ⚠️ 경고 문구 표시 + 확인 버튼이 위험 스타일로 변경
4. 실행 → 성공 시 그래프 갱신, 실패 시 git stderr 그대로 표시

추가 진입점: 툴바 또는 HEAD 컨텍스트에서 **Reset HEAD~N…** — N을 숫자 입력으로 받아 `HEAD~N` 타겟으로 동일 다이얼로그 진행.

### 규칙

- `--hard`는 반드시 확인 다이얼로그를 거친다 (설정으로 끌 수 없음)
- reset 후 uncommitted changes 행이 상태를 반영해 갱신되어야 한다

## 2. git worktree — 목록/추가/제거 + 그래프 표시 `[done]`

원본은 worktree를 전혀 지원하지 않는다.

### 동작

- **목록**: 툴바의 worktree 버튼 → 현재 리포의 worktree 목록 표시 (경로, 체크아웃된 브랜치, HEAD 해시, main worktree 여부)
- **추가**: 목록 패널의 Add → 브랜치 선택(기존 브랜치 또는 새 브랜치명 입력) + 경로 입력 → `git worktree add` 실행 → 목록 갱신
- **제거**: 목록 항목의 Remove → 확인 다이얼로그 → `git worktree remove` 실행. 변경사항이 있어 실패하면 stderr 표시 + "Force remove" 재확인 옵션 제공 ⚠️
- **그래프 표시**: worktree에 체크아웃된 브랜치의 라벨에 worktree 아이콘/뱃지 표시. 해당 브랜치는 일반 checkout이 불가하므로(git 제약) 컨텍스트 메뉴에서 checkout 대신 "Open worktree" (해당 경로를 새 창으로 열기) 제공

## 3. 검색·필터 glob 패턴 지원 `[done]`

원본의 glob은 설정 파일(`customBranchGlobPatterns`)에 **사전 등록한 패턴을 드롭다운에서 고르는 방식**이고 브랜치에만 적용된다. 커밋 검색은 단순 부분 문자열 매칭뿐이다. GitScope의 차별점은 "glob 지원" 자체가 아니라 **즉석 입력 + 커밋 메시지·작성자·해시까지 적용 확대**다. (30-search-filter.md §30.4 참조)

### 동작

- 검색 입력에 glob 메타문자(`*`, `?`, `[...]`)가 포함되면 자동으로 glob 매칭 모드로 동작, 아니면 기존처럼 부분 문자열 매칭
- 적용 대상:
  - **커밋 검색**: 커밋 메시지·작성자·해시에 대해 매칭, 일치 커밋 하이라이트 + 개수 표시 + 이전/다음 이동
  - **브랜치 필터**: 브랜치 필터 드롭다운 상단 입력란에 glob 입력 → 일치하는 브랜치만 그래프에 표시 (예: `feature/*`, `release-[0-9]*`)
- 매칭 규칙: 대소문자 무시, `*`는 `/` 포함 임의 문자열과 매칭(경로 구분 없음), 유효하지 않은 패턴(`[` 미닫힘 등)은 문자 그대로 매칭으로 폴백

## 4. git fetch --prune `[done]`

원본은 fetch 시 원격에서 삭제된 브랜치 참조가 로컬에 남는 문제가 있다.

### 동작

- 툴바 fetch 버튼의 드롭다운(또는 우클릭)에 **Fetch (prune)** 옵션 제공: `git fetch --all --prune` 실행
- 설정 `gitScope.fetchPruneByDefault` (기본 false): true면 기본 fetch 버튼도 `--prune` 포함
- prune으로 원격 브랜치 참조가 제거되면 실행 후 그래프에서 해당 라벨이 사라진다 (그래프 갱신 필수)

## 5. 커밋 메시지 수정 (reword) `[done]`

원본은 임의 커밋의 메시지 수정(reword)을 지원하지 않는다. GitScope는 그래프에서 커밋을 우클릭해 그 커밋의 메시지만 수정한다 — 커밋 내용(tree)·author 정보는 바뀌지 않는다.

### 동작

1. 커밋 우클릭 → **Edit Commit Message…**
2. 다이얼로그: 기존 커밋 메시지 전문(`%B`)이 미리 채워진 textarea 표시, 자유롭게 편집
3. 실행 전략:
   - 대상이 **HEAD**: `git commit --amend --only -m <메시지>` — `--only`로 스테이징된 변경을 포함하지 않고 메시지만 교체 (워킹트리·인덱스 안전)
   - 대상이 **HEAD의 조상**: `git commit-tree`로 동일 tree·부모·author(이름/이메일/날짜 보존)에 새 메시지만 바꾼 커밋 객체를 만들고, `git rebase --rebase-merges --empty=keep --onto <새 커밋> <원본 커밋>`으로 이후 커밋을 재적용. 이후 커밋들의 해시가 바뀌므로 다이얼로그에 ⚠️ 경고 표시 + 확인 버튼 위험 스타일
4. 성공 시 그래프 갱신, 실패 시 git stderr 그대로 표시

### 규칙

- HEAD에서 도달할 수 없는 커밋(다른 브랜치 전용 커밋 등)은 수정 불가 — 안내 후 중단
- 메시지가 비었거나 기존과 동일하면 실행하지 않는다
- committer 정보는 git 기본 규칙대로 현재 사용자/시각으로 갱신된다 (author는 보존)

## 6. Output 채널 git 명령 로깅 `[done]`

익스텐션이 실행하는 모든 git 명령을 VS Code Output 패널의 **Git Scope** 채널에 기록한다 — 디버깅·투명성 목적.

### 동작

- 각 git 명령 종료 시 한 줄 기록: 시각, 명령줄(공백 포함 인자는 인용), exit code(성공은 생략), 소요 시간, 리포 경로
- 실패(허용되지 않은 exit code) 시 stderr를 들여쓰기해 이어서 기록
- 긴 인자(커밋 메시지 등)는 한 줄로 이스케이프하고 일정 길이에서 줄임

## 7. 브랜치 뱃지 드래그앤드롭 merge/rebase `[done]`

원본에는 없는 GitScope 고유 기능. 그래프의 브랜치 뱃지를 드래그해 다른 로컬 브랜치 뱃지에 드롭하면 merge/rebase를 선택해 실행한다.

### 동작

1. **드래그 소스**: 로컬·원격 브랜치 뱃지 (태그는 드래그 불가)
2. **드롭 대상**: 로컬 브랜치 뱃지만. 드래그 중 드롭 가능한 뱃지 위에 있으면 점선 아웃라인 표시. 자기 자신에 드롭하면 무시
3. 드롭 시 다이얼로그 — source(드래그한 브랜치) → target(드롭한 브랜치):
   - **Merge source into target**: target이 현재 브랜치가 아니면 먼저 체크아웃 후 `git merge source` (HEAD 이동 힌트 표시)
   - **Rebase source onto target**: `git rebase target source` — source 커밋 해시 변경 ⚠️ 경고 표시. **원격 source에는 이 선택지를 제공하지 않는다** (detached HEAD 방지)
4. 성공 시 그래프 갱신, 실패(충돌 등) 시 git stderr 그대로 표시

## 8. 스태시 목록 패널 `[done]`

원본은 스태시를 그래프 노드로만 보여준다. GitScope는 스태시만 모아 보는 전용 패널을 추가한다.

### 동작

- 툴바 **Stashes** 버튼으로 토글 (worktree 패널과 동일한 우측 부동 패널, 둘 다 열리면 왼쪽으로 비킴)
- 각 행: `stash@{N}` 셀렉터 + 제목("On <브랜치>: <메시지>") + 날짜
- 행 클릭 → 그래프에서 해당 스태시 커밋 선택 (로드된 범위에 있으면 상세뷰)
- 행 우클릭 → Apply / Pop / Create Branch / Drop ⚠️ / Copy Hash — 그래프 스태시 노드 메뉴와 동일, 실행 후 목록·그래프 동시 갱신
- 하단 **+ Stash Uncommitted Changes** 버튼 — 워킹트리 변경이 없으면 비활성화
