import { createSignal, For, Show } from 'solid-js'

export interface MenuItem {
  label: string
  danger?: boolean
  separatorBefore?: boolean
  onClick: () => void
}

interface MenuState {
  x: number
  y: number
  items: MenuItem[]
}

const [menu, setMenu] = createSignal<MenuState | null>(null)

/** 컨텍스트 메뉴를 (마우스 좌표에) 연다 */
export function openContextMenu(e: MouseEvent, items: MenuItem[]): void {
  e.preventDefault()
  e.stopPropagation()
  setMenu({ x: e.clientX, y: e.clientY, items })
}

export function closeContextMenu(): void {
  setMenu(null)
}

/** app 루트에 한 번만 렌더하는 컨텍스트 메뉴 호스트 */
export function ContextMenuHost() {
  return (
    <Show when={menu()}>
      {(state) => (
        <div class="context-menu-overlay" onClick={closeContextMenu} onContextMenu={(e) => { e.preventDefault(); closeContextMenu() }}>
          <div
            class="context-menu"
            style={{
              left: `${Math.min(state().x, window.innerWidth - 240)}px`,
              top: `${Math.min(state().y, window.innerHeight - state().items.length * 26 - 12)}px`,
            }}
          >
            <For each={state().items}>
              {(item) => (
                <>
                  <Show when={item.separatorBefore}>
                    <div class="context-menu-separator" />
                  </Show>
                  <button
                    class="context-menu-item"
                    classList={{ danger: item.danger }}
                    onClick={() => {
                      closeContextMenu()
                      item.onClick()
                    }}
                  >
                    {item.label}
                  </button>
                </>
              )}
            </For>
          </div>
        </div>
      )}
    </Show>
  )
}
