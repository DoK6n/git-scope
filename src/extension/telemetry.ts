import * as vscode from 'vscode'
import { TelemetryReporter } from '@vscode/extension-telemetry'

// Azure Application Insights connection string.
// 비밀값이 아니라 수집 엔드포인트 식별자라서 소스에 포함해도 된다(MS 공식 익스텐션들과 동일).
// 빈 값이면 reporter를 만들지 않아 아무것도 전송되지 않는다.
const CONNECTION_STRING: string =
  'InstrumentationKey=833a7fb2-3a74-4b7c-9f52-51226541bc00;IngestionEndpoint=https://koreasouth-0.in.applicationinsights.azure.com/;LiveEndpoint=https://koreasouth.livediagnostics.monitor.azure.com/;ApplicationId=ec8a9e8d-44cc-41c6-b31e-092c3e1edd41'

let reporter: TelemetryReporter | null = null

/**
 * 텔레메트리 초기화. TelemetryReporter는 내부적으로 vscode.env.createTelemetryLogger를
 * 사용하므로 사용자의 telemetry.telemetryLevel 설정 존중과 PII 스크러빙은 자동이다.
 */
export function activateTelemetry(context: vscode.ExtensionContext): void {
  if (CONNECTION_STRING === '') return
  reporter = new TelemetryReporter(CONNECTION_STRING)
  context.subscriptions.push(reporter)
}

/**
 * 단순 발생 이벤트 (activate, graphOpen 등).
 * 리포 내용(커밋 메시지·브랜치명·경로·에러 문자열)은 절대 넣지 않는다.
 */
export function sendEvent(name: string, properties?: Record<string, string>): void {
  reporter?.sendTelemetryEvent(name, properties)
}

/** git 액션 결과 — 명령 이름 + 성공 여부 + 소요 시간만 전송한다 */
export function sendActionEvent(command: string, ok: boolean, durationMs: number): void {
  if (!reporter) return
  const properties = { command, outcome: ok ? 'ok' : 'error' }
  const measurements = { durationMs }
  if (ok) reporter.sendTelemetryEvent('action', properties, measurements)
  else reporter.sendTelemetryErrorEvent('action', properties, measurements)
}
