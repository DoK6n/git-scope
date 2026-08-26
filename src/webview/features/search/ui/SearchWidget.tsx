import { createEffect, createSignal, onCleanup, onMount } from 'solid-js'
import { searchStore } from '../model/search'

function ArrowIcon(props: { direction: 'up' | 'down' }) {
  const path = () =>
    props.direction === 'up'
      ? 'M6 13V3.9L2.7 7.2 1.3 5.8 7 .1l5.7 5.7-1.4 1.4L8 3.9V13H6z'
      : 'M6 1v9.1L2.7 6.8 1.3 8.2 7 13.9l5.7-5.7-1.4-1.4L8 10.1V1H6z'
  return (
    <svg viewBox="0 0 14 14" aria-hidden="true">
      <path d={path()} fill="currentColor" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 14 14" aria-hidden="true">
      <path
        d="M3.8 2.4 2.4 3.8 5.7 7l-3.3 3.2 1.4 1.4L7 8.3l3.2 3.3 1.4-1.4L8.3 7l3.3-3.2-1.4-1.4L7 5.7 3.8 2.4z"
        fill="currentColor"
      />
    </svg>
  )
}

export function SearchWidget() {
  let inputRef: HTMLInputElement | undefined
  const [open, setOpen] = createSignal(false)
  const [focused, setFocused] = createSignal(false)
  const [history, setHistory] = createSignal<string[]>([])
  const [historyIndex, setHistoryIndex] = createSignal(-1)

  const rememberQuery = () => {
    const value = searchStore.query().trim()
    if (value === '') return
    setHistory((items) => [...items.filter((item) => item !== value), value])
    setHistoryIndex(-1)
  }

  const close = () => {
    rememberQuery()
    setFocused(false)
    setOpen(false)
    searchStore.search('')
  }

  const focusInput = () => {
    queueMicrotask(() => {
      inputRef?.focus()
      inputRef?.select()
    })
  }

  onMount(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        event.stopPropagation()
        setOpen(true)
        focusInput()
        return
      }
      if (event.key === 'Escape' && open()) {
        event.preventDefault()
        event.stopPropagation()
        close()
      }
    }
    window.addEventListener('keydown', handleKeyDown, true)
    onCleanup(() => window.removeEventListener('keydown', handleKeyDown, true))
  })

  createEffect(() => {
    if (!open()) return
    focusInput()
  })

  const hasQuery = () => searchStore.query().trim() !== ''
  const hasMatches = () => searchStore.matchRows().length > 0

  const moveHistory = (delta: -1 | 1) => {
    const items = history()
    if (items.length === 0) return
    const current = historyIndex()
    const next =
      delta === -1
        ? current === -1
          ? items.length - 1
          : Math.max(0, current - 1)
        : current === -1
          ? -1
          : current + 1 < items.length
            ? current + 1
            : -1
    setHistoryIndex(next)
    searchStore.search(next === -1 ? '' : items[next]!)
    queueMicrotask(() => inputRef?.setSelectionRange(inputRef.value.length, inputRef.value.length))
  }

  return (
      <div
        class="find-widget"
        classList={{ open: open() }}
        role="search"
        aria-hidden={!open()}
      >
        <div class="find-widget-part">
          <div class="find-widget-input-wrap">
            <input
              ref={(el) => (inputRef = el)}
              class="find-widget-input"
              type="text"
              disabled={!open()}
              placeholder={focused() ? 'Find (↑↓ for history)' : 'Find'}
              value={searchStore.query()}
              spellcheck={false}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onInput={(event) => {
                setHistoryIndex(-1)
                searchStore.search(event.currentTarget.value)
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                  event.preventDefault()
                  moveHistory(event.key === 'ArrowUp' ? -1 : 1)
                  return
                }
                if (event.key !== 'Enter') return
                event.preventDefault()
                rememberQuery()
                if (event.shiftKey) searchStore.prev()
                else searchStore.next()
              }}
            />
            <span class="find-widget-modifiers">
              <button
                class="find-modifier"
                classList={{ active: searchStore.caseSensitive() }}
                title="Match Case"
                disabled={!open()}
                onMouseDown={(event) => event.preventDefault()}
                onClick={searchStore.toggleCaseSensitive}
              >
                Aa
              </button>
              <button
                class="find-modifier find-whole-word"
                classList={{ active: searchStore.wholeWord() }}
                title="Match Whole Word"
                disabled={!open()}
                onMouseDown={(event) => event.preventDefault()}
                onClick={searchStore.toggleWholeWord}
              >
                ab
              </button>
              <button
                class="find-modifier find-regex"
                classList={{ active: searchStore.useRegex() }}
                title="Use Regular Expression"
                disabled={!open()}
                onMouseDown={(event) => event.preventDefault()}
                onClick={searchStore.toggleRegex}
              >
                .*
              </button>
            </span>
          </div>
          <span
            class="find-widget-status"
            classList={{ 'no-results': hasQuery() && !hasMatches() }}
          >
            {hasMatches()
              ? `${searchStore.currentMatchNumber()} of ${searchStore.matchRows().length}`
              : 'No results'}
          </span>
          <button
            class="find-widget-action"
            title="Previous match (Shift+Enter)"
            disabled={!open() || !hasMatches()}
            onClick={searchStore.prev}
          >
            <ArrowIcon direction="up" />
          </button>
          <button
            class="find-widget-action"
            title="Next match (Enter)"
            disabled={!open() || !hasMatches()}
            onClick={searchStore.next}
          >
            <ArrowIcon direction="down" />
          </button>
        </div>
        <button
          class="find-widget-action find-widget-close"
          title="Close (Escape)"
          disabled={!open()}
          onClick={close}
        >
          <CloseIcon />
        </button>
      </div>
  )
}
