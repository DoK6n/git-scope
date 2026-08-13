---
name: gs-release
description: GitScope 릴리즈 절차. 버전 범프, 체인지로그 정리, vsce 패키징, 마켓플레이스 배포. 릴리즈 준비나 .vsix 로컬 패키징이 필요할 때 사용.
---

# GS Release

## 사전 체크리스트

- [ ] `npm run build`(host esbuild + webview vite) 성공, 타입 에러 0
- [ ] 테스트 통과
- [ ] Extension Development Host에서 스모크 테스트: 그래프 로딩, 액션 1개 이상 실행
- [ ] `CHANGELOG.md`의 `[Unreleased]`에 이번 릴리즈 내용이 정리되어 있음
- [ ] `README.md` 스크린샷/기능 목록이 현재 상태와 일치
- [ ] 클린룸 확인: 이번 릴리즈에 원본 유래 코드가 없음 (cleanroom-guard 규칙 준수 여부)

## 절차

1. **버전 범프** — semver. `package.json` version 수정
   - 신규 기능: minor / 버그픽스만: patch / 호환성 파괴: major
2. **체인지로그** — `[Unreleased]` → `[x.y.z] - YYYY-MM-DD`로 승격, 새 `[Unreleased]` 섹션 생성
3. **패키징** — `npx vsce package` → `.vsix` 생성. 로컬 설치 테스트: `code --install-extension git-scope-x.y.z.vsix`
4. **태그** — `git tag vx.y.z && git push --tags`
5. **배포** — `npx vsce publish` (VSCE_PAT 필요). Open VSX도 배포하려면 `npx ovsx publish`
6. **GitHub Release** — 태그에 체인지로그 내용으로 릴리즈 노트 작성

## 주의

- `publisher`, 아이콘, `repository` 필드가 package.json에 있어야 vsce가 통과된다
- 첫 배포 전 [마켓플레이스 publisher](https://marketplace.visualstudio.com/manage) 생성 필요
- 배포는 되돌릴 수 없으므로(unpublish는 가능하나 버전 재사용 불가) 패키징 → 로컬 설치 검증 → 배포 순서를 지킨다
