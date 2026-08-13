import type {
  BridgeEvent,
  BridgeRequest,
  HostMessage,
  RequestCommand,
  RequestMap,
  WebviewSettings,
} from '@shared-types/messages'

declare global {
  interface Window {
    __GITSCOPE_SETTINGS__: WebviewSettings
  }
  function acquireVsCodeApi(): { postMessage(message: unknown): void }
}

const vscodeApi = acquireVsCodeApi()

let nextId = 1
const pending = new Map<
  number,
  { resolve: (value: never) => void; reject: (error: Error) => void }
>()
const eventListeners = new Set<(event: BridgeEvent) => void>()

window.addEventListener('message', (e: MessageEvent<HostMessage>) => {
  const message = e.data
  if (message.kind === 'response') {
    const entry = pending.get(message.id)
    if (!entry) return
    pending.delete(message.id)
    if (message.ok) entry.resolve(message.result as never)
    else entry.reject(new Error(message.error))
  } else if (message.kind === 'event') {
    for (const listener of eventListeners) listener(message)
  }
})

/** host에 요청을 보내고 응답을 기다린다 */
export function request<C extends RequestCommand>(
  command: C,
  params: RequestMap[C]['params'],
): Promise<RequestMap[C]['result']> {
  return new Promise((resolve, reject) => {
    const id = nextId++
    pending.set(id, { resolve, reject })
    const message: BridgeRequest<C> = { kind: 'request', id, command, params }
    vscodeApi.postMessage(message)
  })
}

export function onBridgeEvent(listener: (event: BridgeEvent) => void): () => void {
  eventListeners.add(listener)
  return () => eventListeners.delete(listener)
}

export function initialSettings(): WebviewSettings {
  return window.__GITSCOPE_SETTINGS__
}
