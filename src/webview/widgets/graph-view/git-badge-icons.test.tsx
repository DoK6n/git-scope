// @vitest-environment jsdom
import { render } from 'solid-js/web'
import { For } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BridgeRequest } from '@shared-types/messages'
import type { Commit } from '@shared-types/domain'
import type { RefGroup } from '../../entities/ref'

vi.stubGlobal('acquireVsCodeApi', () => ({ postMessage: (_message: BridgeRequest) => {} }))
;(window as unknown as { __GITSCOPE_SETTINGS__: unknown }).__GITSCOPE_SETTINGS__ = {
  initialLoadCommits: 300,
  loadMoreCommits: 100,
  dateType: 'author',
  fetchPruneByDefault: false,
  language: 'en',
}

const { RefBadge } = await import('../../entities/ref')
const { CommitRow } = await import('./ui/CommitRow')

const disposers: (() => void)[] = []
afterEach(() => {
  while (disposers.length > 0) disposers.pop()!()
  document.body.innerHTML = ''
})

function mount(view: () => unknown): HTMLElement {
  const root = document.createElement('div')
  document.body.append(root)
  disposers.push(render(view as never, root))
  return root
}

describe('Git reference badge icons', () => {
  it('uses distinct local branch, remote branch, and tag icons', () => {
    const groups: RefGroup[] = [
      { ref: { name: 'main', hash: 'a', type: 'head' }, remotes: [] },
      {
        ref: { name: 'origin/topic', hash: 'b', type: 'remote', remote: 'origin' },
        remotes: [],
      },
      { ref: { name: 'v1.0.0', hash: 'c', type: 'tag' }, remotes: [] },
    ]
    const root = mount(() => (
      <For each={groups}>{(group) => <RefBadge group={group} color="#53c17f" />}</For>
    ))
    expect(
      [...root.querySelectorAll('.ref-icon [data-icon]')].map((icon) =>
        icon.getAttribute('data-icon'),
      ),
    ).toEqual(['branch', 'remote', 'tag'])
  })

  it('uses each graph lane color for its reference icon chip', () => {
    const cases: { group: RefGroup; color: string }[] = [
      {
        group: { ref: { name: 'main', hash: 'a', type: 'head' }, remotes: [] },
        color: 'rgb(83, 193, 127)',
      },
      {
        group: { ref: { name: 'v1.0.0', hash: 'b', type: 'tag' }, remotes: [] },
        color: 'rgb(214, 119, 74)',
      },
    ]
    const root = mount(() => (
      <For each={cases}>
        {(testCase) => <RefBadge group={testCase.group} color={testCase.color} />}
      </For>
    ))
    expect(
      [...root.querySelectorAll<HTMLElement>('.ref-icon')].map(
        (icon) => icon.style.backgroundColor,
      ),
    ).toEqual(cases.map((testCase) => testCase.color))
  })

  it('uses the stash icon on a stash commit badge', () => {
    const stash: Commit = {
      hash: 'abc',
      parents: ['parent'],
      author: 'Test',
      authorEmail: 'test@example.com',
      authorDate: 1,
      commitDate: 1,
      subject: 'WIP on main',
      stashSelector: 'stash@{0}',
    }
    const root = mount(() => (
      <CommitRow
        commit={stash}
        top={0}
        graphWidth={20}
        refs={[]}
        colorIndex={0}
        selected={false}
        onClick={() => {}}
        onContextMenu={() => {}}
      />
    ))
    expect(root.querySelector('.stash-badge [data-icon="stash"]')).toBeTruthy()
    expect(
      (root.querySelector('.stash-badge .ref-icon') as HTMLElement).style.backgroundColor,
    ).not.toBe('')
  })
})
