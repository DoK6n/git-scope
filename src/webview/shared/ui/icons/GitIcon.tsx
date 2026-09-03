import { For } from 'solid-js'

export type GitIconName =
  | 'branch'
  | 'remote'
  | 'tag'
  | 'stash'
  | 'read'
  | 'change'
  | 'danger'
  | 'statistics'
  | 'reset'
  | 'worktree'
  | 'pull'
  | 'fetch'
  | 'prune'
  | 'refresh'

const PATHS: Record<GitIconName, string[]> = {
  branch: [
    'M4 2.5a1.5 1.5 0 1 0 0 .01M4 5v6a2 2 0 0 0 2 2h1',
    'M11.5 4a1.5 1.5 0 1 0 0 .01M10 4.5v1A3.5 3.5 0 0 1 6.5 9H4',
  ],
  remote: [
    'M5 12H4a2.5 2.5 0 0 1-.3-5A4 4 0 0 1 11.5 6a2.5 2.5 0 0 1 .5 5.95H11',
    'M6 9.5h4',
  ],
  tag: ['M2.5 3h4.7l6.3 6.3-4.2 4.2L3 7.2V3Z', 'M5.3 5.3h.01'],
  stash: ['M2 4h12v9H2V4Z', 'M1.5 4 3 2.5h10L14.5 4M6 7h4'],
  read: ['M1.5 8s2.3-4 6.5-4 6.5 4 6.5 4-2.3 4-6.5 4S1.5 8 1.5 8Z', 'M8 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z'],
  change: ['M2 8h4M10 8h4', 'M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z'],
  danger: ['M3 4.5h10M6 4.5V3h4v1.5M5 6.5v6M8 6.5v6M11 6.5v6M4 4.5l.7 9h6.6l.7-9'],
  statistics: ['M2.5 13.5V8h3v5.5h-3ZM6.5 13.5V3h3v10.5h-3ZM10.5 13.5V6h3v7.5h-3Z'],
  reset: ['M3 5V2.5L1 4.5 3 6.5V5a5.5 5.5 0 1 1-.3 6.2', 'M8 5v3l2 1.5'],
  worktree: ['M2 2.5h4v4H2v-4ZM10 9.5h4v4h-4v-4Z', 'M6 4.5h2a2 2 0 0 1 2 2v3'],
  pull: ['M8 2.5v9M4.8 8.8 8 12l3.2-3.2', 'M3 14h10'],
  fetch: [
    'M5 12H4a2.5 2.5 0 0 1-.3-5A4 4 0 0 1 11.5 6a2.5 2.5 0 0 1 .5 5.95H11',
    'M8 7.5v6M5.8 11.3 8 13.5l2.2-2.2',
  ],
  prune: ['M5.2 5.3 13.5 13M5.2 10.7 13.5 3', 'M3.5 2.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM3.5 9.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z'],
  refresh: ['M13.5 5.5V2.5l-1.7 1.7A5.5 5.5 0 1 0 13.3 10', 'M13.5 2.5h-3'],
}

export function GitIcon(props: { name: GitIconName; size?: number; class?: string }) {
  const size = () => props.size ?? 16
  return (
    <svg
      class={`git-icon${props.class ? ` ${props.class}` : ''}`}
      data-icon={props.name}
      viewBox="0 0 16 16"
      width={size()}
      height={size()}
      fill="none"
      stroke="currentColor"
      stroke-width="1.35"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <For each={PATHS[props.name]}>{(path) => <path d={path} />}</For>
    </svg>
  )
}
