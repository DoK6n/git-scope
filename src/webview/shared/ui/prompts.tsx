import { createSignal, For, Show } from 'solid-js'
import { t } from '../lib'
import { Dialog } from './Dialog'

/** 폼 다이얼로그 필드 정의 */
export type FieldSpec =
  | { kind: 'text'; name: string; label: string; placeholder?: string; initial?: string }
  | { kind: 'textarea'; name: string; label: string; placeholder?: string; initial?: string; rows?: number }
  | { kind: 'number'; name: string; label: string; initial?: number; min?: number }
  | { kind: 'checkbox'; name: string; label: string; initial?: boolean }
  | {
      kind: 'radio'
      name: string
      label: string
      options: { value: string; label: string; hint?: string; danger?: boolean }[]
      initial?: string
    }
  | { kind: 'select'; name: string; label: string; options: string[]; initial?: string }

export type FormValues = Record<string, string | number | boolean>

/**
 * 다이얼로그 본문에 표시하는 읽기 전용 항목 리스트 —
 * 위험 액션의 대상(지워질 커밋, 삭제될 스태시 등)을 확인용으로 나열할 때 쓴다.
 */
export interface DialogList {
  items: { code: string; text: string; mark?: string }[]
  /** items에 담지 못한 나머지 개수 — "… and N more"로 표시 */
  more?: number
  /** 리스트 아래 강조 줄 (예: 새 HEAD 안내) */
  footer?: string
}

interface FormState {
  title: string
  /** 다이얼로그 상단 설명 문구 */
  note?: string
  /** note 아래 읽기 전용 항목 리스트 */
  list?: DialogList
  fields: FieldSpec[]
  confirmLabel: string
  danger: boolean
  /** 값에 따라 표시할 경고 문구 (예: hard reset) */
  warning?: (values: FormValues) => string | null
  resolve: (values: FormValues | null) => void
}

interface ConfirmState {
  title: string
  message: string
  confirmLabel: string
  danger: boolean
  resolve: (ok: boolean) => void
}

interface ErrorState {
  title: string
  message: string
  resolve: () => void
}

const [formState, setFormState] = createSignal<FormState | null>(null)
const [confirmState, setConfirmState] = createSignal<ConfirmState | null>(null)
const [errorState, setErrorState] = createSignal<ErrorState | null>(null)

/** 입력 폼 다이얼로그를 띄우고 값을 받는다. 취소하면 null */
export function formDialog(opts: {
  title: string
  note?: string
  list?: DialogList
  fields: FieldSpec[]
  confirmLabel?: string
  danger?: boolean
  warning?: (values: FormValues) => string | null
}): Promise<FormValues | null> {
  return new Promise((resolve) => {
    setFormState({
      title: opts.title,
      note: opts.note,
      list: opts.list,
      fields: opts.fields,
      confirmLabel: opts.confirmLabel ?? 'OK',
      danger: opts.danger ?? false,
      warning: opts.warning,
      resolve,
    })
  })
}

/** 액션 실패 다이얼로그 — git stderr를 그대로 보여주고 Dismiss로 닫는다 */
export function errorDialog(opts: { title: string; message: string }): Promise<void> {
  return new Promise((resolve) => {
    setErrorState({ title: opts.title, message: opts.message, resolve })
  })
}

/** 확인 다이얼로그. 확인하면 true */
export function confirmDialog(opts: {
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
}): Promise<boolean> {
  return new Promise((resolve) => {
    setConfirmState({
      title: opts.title,
      message: opts.message,
      confirmLabel: opts.confirmLabel ?? 'OK',
      danger: opts.danger ?? false,
      resolve,
    })
  })
}

function initialValues(fields: FieldSpec[]): FormValues {
  const values: FormValues = {}
  for (const field of fields) {
    if (field.kind === 'checkbox') values[field.name] = field.initial ?? false
    else if (field.kind === 'number') values[field.name] = field.initial ?? 0
    else if (field.kind === 'radio') values[field.name] = field.initial ?? field.options[0]!.value
    else if (field.kind === 'select') values[field.name] = field.initial ?? field.options[0] ?? ''
    else values[field.name] = field.initial ?? ''
  }
  return values
}

/** app 루트에 한 번만 렌더하는 폼/확인 다이얼로그 호스트 */
export function PromptHost() {
  return (
    <>
      <Show when={formState()}>{(state) => <FormDialogView state={state()} />}</Show>
      <Show when={confirmState()}>
        {(state) => (
          <Dialog
            open
            title={state().title}
            onClose={() => {
              state().resolve(false)
              setConfirmState(null)
            }}
            footer={
              <>
                <button
                  class="toolbar-btn"
                  onClick={() => {
                    state().resolve(false)
                    setConfirmState(null)
                  }}
                >
                  Cancel
                </button>
                <button
                  class={`toolbar-btn ${state().danger ? 'danger' : 'primary'}`}
                  onClick={() => {
                    state().resolve(true)
                    setConfirmState(null)
                  }}
                >
                  {state().confirmLabel}
                </button>
              </>
            }
          >
            <div style={{ 'white-space': 'pre-wrap' }}>{state().message}</div>
          </Dialog>
        )}
      </Show>
      <Show when={errorState()}>
        {(state) => {
          const close = () => {
            state().resolve()
            setErrorState(null)
          }
          return (
            <Dialog
              open
              title={`⚠ Error: ${state().title}`}
              onClose={close}
              footer={
                <button class="toolbar-btn" onClick={close}>
                  Dismiss
                </button>
              }
            >
              <div class="dialog-error-message">{state().message}</div>
            </Dialog>
          )
        }}
      </Show>
    </>
  )
}

function FormDialogView(props: { state: FormState }) {
  // 다이얼로그가 열릴 때 한 번만 초기값을 계산한다 — 의도된 비반응성 읽기
  // eslint-disable-next-line solid/reactivity
  const [values, setValues] = createSignal<FormValues>(initialValues(props.state.fields))
  const set = (name: string, value: string | number | boolean) =>
    setValues((v) => ({ ...v, [name]: value }))

  const close = (result: FormValues | null) => {
    props.state.resolve(result)
    setFormState(null)
  }

  const warning = () => props.state.warning?.(values()) ?? null

  return (
    <Dialog
      open
      title={props.state.title}
      onClose={() => close(null)}
      footer={
        <>
          <button class="toolbar-btn" onClick={() => close(null)}>
            Cancel
          </button>
          <button
            class={`toolbar-btn ${props.state.danger ? 'danger' : 'primary'}`}
            onClick={() => close(values())}
          >
            {props.state.confirmLabel}
          </button>
        </>
      }
    >
      <Show when={props.state.note}>
        <div class="dialog-note">{props.state.note}</div>
      </Show>
      <Show when={props.state.list}>
        {(list) => (
          <div class="dialog-list">
            <For each={list().items}>
              {(item) => (
                <div class="dialog-list-item">
                  <code>{item.code}</code>
                  <span class="dialog-list-text">{item.text}</span>
                  <Show when={item.mark}>
                    <span class="dialog-list-mark">{item.mark}</span>
                  </Show>
                </div>
              )}
            </For>
            <Show when={(list().more ?? 0) > 0}>
              <div class="dialog-list-more">{t('… and {0} more', list().more!)}</div>
            </Show>
            <Show when={list().footer}>
              <div class="dialog-list-footer">{list().footer}</div>
            </Show>
          </div>
        )}
      </Show>
      <For each={props.state.fields}>
        {(field) => (
          <div class="dialog-field">
            <Show when={field.kind === 'text'}>
              <label>{field.label}</label>
              <input
                type="text"
                placeholder={(field as Extract<FieldSpec, { kind: 'text' }>).placeholder}
                value={String(values()[field.name] ?? '')}
                onInput={(e) => set(field.name, e.currentTarget.value)}
              />
            </Show>
            <Show when={field.kind === 'textarea'}>
              <label>{field.label}</label>
              <textarea
                rows={(field as Extract<FieldSpec, { kind: 'textarea' }>).rows ?? 6}
                placeholder={(field as Extract<FieldSpec, { kind: 'textarea' }>).placeholder}
                value={String(values()[field.name] ?? '')}
                onInput={(e) => set(field.name, e.currentTarget.value)}
              />
            </Show>
            <Show when={field.kind === 'number'}>
              <label>{field.label}</label>
              <input
                type="number"
                min={(field as Extract<FieldSpec, { kind: 'number' }>).min}
                value={Number(values()[field.name] ?? 0)}
                onInput={(e) => set(field.name, Number(e.currentTarget.value))}
              />
            </Show>
            <Show when={field.kind === 'checkbox'}>
              <label class="dialog-checkbox">
                <input
                  type="checkbox"
                  checked={Boolean(values()[field.name])}
                  onChange={(e) => set(field.name, e.currentTarget.checked)}
                />
                {field.label}
              </label>
            </Show>
            <Show when={field.kind === 'radio'}>
              <label>{field.label}</label>
              <For each={(field as Extract<FieldSpec, { kind: 'radio' }>).options}>
                {(option) => (
                  <label class="dialog-radio">
                    <input
                      type="radio"
                      name={field.name}
                      checked={values()[field.name] === option.value}
                      onChange={() => set(field.name, option.value)}
                    />
                    <span>
                      {option.label}
                      <Show when={option.hint}>
                        {' '}
                        <span class="hint">— {option.hint}</span>
                      </Show>
                    </span>
                  </label>
                )}
              </For>
            </Show>
            <Show when={field.kind === 'select'}>
              <label>{field.label}</label>
              <select
                value={String(values()[field.name] ?? '')}
                onChange={(e) => set(field.name, e.currentTarget.value)}
              >
                <For each={(field as Extract<FieldSpec, { kind: 'select' }>).options}>
                  {(option) => <option value={option}>{option}</option>}
                </For>
              </select>
            </Show>
          </div>
        )}
      </For>
      <Show when={warning()}>
        <div class="dialog-warning">⚠️ {warning()}</div>
      </Show>
    </Dialog>
  )
}
