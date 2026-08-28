# 텔레메트리 도입 노트

> 2026-08-28 작성. `feat/telemetry` 브랜치 작업 전 조사 내용 정리.
> 참고: https://code.visualstudio.com/api/extension-guides/telemetry

## 결론 (추천 방향)

**API 레이어는 공식 가이드를 따르고, 백엔드만 선택한다.**

- `vscode.env.createTelemetryLogger()` — 백엔드가 뭐든 무조건 이 API를 거친다.
- 백엔드는 커스텀 `TelemetrySender`(`sendEventData` / `sendErrorData` 두 메서드) 뒤에 숨겨,
  나중에 교체가 파일 하나 수정으로 끝나게 한다.

## 왜 `createTelemetryLogger`인가

- 사용자의 `telemetry.telemetryLevel` 설정과 `isTelemetryEnabled`를 **자동으로 존중**
  (직접 구현 시 수동 체크 필요, 누락하면 마켓플레이스 가이드라인 위반)
- 경로·이메일 등 PII 기본 스크러빙
- 사용자가 `--log telemetry`로 전송 내용을 Output 채널에서 확인 가능 → 신뢰성

## 백엔드 선택지

| 백엔드 | 비고 |
|---|---|
| `@vscode/extension-telemetry` (Azure App Insights) | 코드 최소. connection string만 넣으면 끝. Azure 계정 필요 |
| Aptabase | 프라이버시 중심 경량 분석, 익명 집계, 무료 티어 충분, **카드 등록 불필요** |
| PostHog | 이벤트 상세 분석까지 원할 때. 무료 티어 넉넉함 |
| 자체 엔드포인트 | 완전 제어 가능하나 서버 유지 부담 |

## Azure App Insights 비용

실사용 규모에서는 **사실상 무료**.

- 데이터 수집량(ingestion) 기준 과금, **월 5GB까지 무료** (Azure Monitor 무료 할당량)
- 초과분 GB당 약 $2.3, 데이터 보존 90일까지 무료
- 이벤트 하나 ~1KB → 5GB 초과하려면 월 수백만 건 필요. GitScope 규모에서는 월 수 MB 수준

### 신경 쓸 점

1. **Azure 계정에 카드 등록 필요** — 사실상 가장 큰 진입장벽
2. 버그로 이벤트가 폭주해도 과금이 튀지 않도록 App Insights 리소스에
   **일일 수집 상한(daily cap)** 을 낮게 걸어둘 것 (상한 도달 시 수집만 멈춤)
3. 무료 5GB는 리소스가 아니라 **결제 계정 단위** — 다른 Azure 리소스와 공유됨

카드 등록이 꺼려지면 Aptabase 쪽이 부담이 덜하다.

## 배포 전 컴플라이언스 체크리스트

- [x] README에 수집 데이터 항목과 opt-out 방법(`telemetry.telemetryLevel`) 명시 — 마켓플레이스 요구사항
- [x] 루트에 `telemetry.json` 작성 — `vsce ls --telemetry` 등으로 수집 항목 투명하게 노출 (권장)
- [x] 커밋 메시지·브랜치명·경로 등 **리포 내용은 절대 이벤트에 넣지 않기**
      — git 익스텐션 특성상 실수하기 쉬운 지점. 이벤트는 "reset 다이얼로그 열림",
      "worktree 추가 성공/실패" 수준의 **행위 + 결과**만 담는다

## 적용 내역 (2026-08-28)

`@vscode/extension-telemetry` v1.5.2 적용 완료. v1.x는 내부적으로
`vscode.env.createTelemetryLogger`를 사용하므로 설정 존중·PII 스크러빙이 자동이다.

| 파일 | 역할 |
|---|---|
| `src/extension/telemetry.ts` | reporter 싱글턴 + `sendEvent` / `sendActionEvent` |
| `src/extension/main.ts` | `activateTelemetry()` 초기화, `activate` / `graphOpen` 이벤트 |
| `src/extension/bridge/router.ts` | `handle()`에서 mutating 명령의 `action` 이벤트 (command, outcome, durationMs) |
| `telemetry.json` | 수집 항목 공개 문서 |
| `README.md` | Telemetry 섹션 (수집 내용 + opt-out) |

이벤트: `activate`, `graphOpen`, `action { command, outcome }` + `durationMs`.
에러 문자열·파라미터는 리포 내용을 포함할 수 있어 전송하지 않는다.

### 남은 작업 — 활성화 절차

`src/extension/telemetry.ts`의 `CONNECTION_STRING`이 빈 값이라 **현재는 아무것도 전송되지 않는다.**

1. Azure Portal → Application Insights 리소스 생성 (workspace-based)
2. 리소스 개요 화면의 **Connection String** 복사
3. `CONNECTION_STRING` 상수에 붙여넣기 (비밀값 아님 — 커밋해도 됨)
4. 리소스에 **daily cap** 낮게 설정 (비용 폭주 방지)
