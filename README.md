# Git Scope

커밋 그래프 시각화 + 그래프에서 직접 git 액션을 실행하는 VS Code/Cursor 익스텐션.
방치된 Git Graph(mhutchie)의 컨셉을 클린룸으로 재구현한 프로젝트입니다.

## 사용법

명령 팔레트(`Cmd+Shift+P`) → **Git Scope: View Git Graph**

## 기능

- 커밋 그래프: 브랜치 레인·색상, 브랜치/원격/태그 라벨, HEAD 표시, 스크롤 증분 로딩
- 커밋 상세: 변경 파일 목록, 클릭으로 디프 열기
- 액션: checkout, 브랜치 생성/삭제/rename, merge, tag — 위험 액션은 확인 다이얼로그
- **git reset**: soft/mixed/hard 모드 + 커밋 타겟/HEAD~N 지정
- **glob 검색·필터**: 커밋 검색과 브랜치 필터에 `feature/*` 같은 패턴 즉석 입력
- **git fetch --prune**: fetch 버튼 우클릭으로 삭제된 원격 브랜치 참조 정리
- **git worktree**: 목록/추가/제거 패널, 그래프 라벨에 ⊕ 뱃지, 새 창으로 열기

## 개발

```bash
npm install
npm run build      # host(esbuild) + webview(vite)
npm test           # vitest
```

로컬 패키징: `npx @vscode/vsce package --no-dependencies`
