# 60. 신규 기능 (원본에 없거나 부족한 것)

GitScope가 원본 Git Graph 대비 추가로 제공하는 필수 신규 기능 4종의 명세. 모두 GitScope 자체 설계이며 원본 관찰에서 유래하지 않는다.

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
