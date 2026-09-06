// @vitest-environment jsdom
import { render } from 'solid-js/web'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BridgeRequest } from '@shared-types/messages'

const sent: BridgeRequest[] = []

function respond(id: number, result: unknown): void {
  window.dispatchEvent(
    new MessageEvent('message', { data: { kind: 'response', id, ok: true, result } }),
  )
}

const EMPTY_GRAPH = {
  commits: [],
  refs: [],
  headHash: null,
  headBranch: 'main',
  uncommittedCount: 0,
  moreAvailable: false,
  worktreeBranches: [],
}

vi.stubGlobal('acquireVsCodeApi', () => ({
  postMessage: (message: BridgeRequest) => {
    sent.push(message)
    if (message.command === 'getGraph') setTimeout(() => respond(message.id, EMPTY_GRAPH), 0)
  },
}))
;(window as unknown as { __GITSCOPE_SETTINGS__: unknown }).__GITSCOPE_SETTINGS__ = {
  initialLoadCommits: 300,
  loadMoreCommits: 100,
  dateType: 'author',
  fetchPruneByDefault: false,
  language: 'en',
}

const { PromptHost } = await import('../../shared/ui')
const { graphStore } = await import('../../entities/graph')
const { checkoutRemoteBranch } = await import('./index')

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function button(label: string): HTMLButtonElement {
  return [...document.querySelectorAll<HTMLButtonElement>('.dialog-footer button')].find(
    (candidate) => candidate.textContent === label,
  )!
}

async function submitLocalName(name = 'feat/search'): Promise<{ done: Promise<void> }> {
  const done = checkoutRemoteBranch('upstream/feat/search', 'upstream')
  await flush()
  const input = document.querySelector<HTMLInputElement>('.dialog-field input[type=text]')!
  input.value = name
  input.dispatchEvent(new Event('input', { bubbles: true }))
  button('Checkout').click()
  await flush()
  return { done }
}

function requestFor(command: BridgeRequest['command']): BridgeRequest {
  return [...sent].reverse().find((request) => request.command === command)!
}

describe('remote branch checkout flow', () => {
  let dispose: () => void

  beforeEach(async () => {
    sent.length = 0
    document.body.innerHTML = '<div id="root"></div>'
    dispose = render(() => <PromptHost />, document.getElementById('root')!)
    await graphStore.switchRepo('/fake/repo')
    sent.length = 0
  })

  afterEach(() => dispose())

  it('creates the tracking branch when the local branch does not exist', async () => {
    const { done } = await submitLocalName()
    const plan = requestFor('getRemoteCheckoutPlan')
    expect(plan.params).toEqual({
      repo: '/fake/repo',
      remote: 'upstream',
      branch: 'feat/search',
      localName: 'feat/search',
    })

    respond(plan.id, { localExists: false, ahead: 0, behind: 0 })
    await flush()
    const checkout = requestFor('checkoutRemoteBranch')
    expect(checkout.params).toEqual({
      repo: '/fake/repo',
      remote: 'upstream',
      branch: 'feat/search',
      localName: 'feat/search',
      mode: 'create',
    })
    respond(checkout.id, { ok: true })
    await done
  })

  it('shows exact counts and confirms checkout plus pull for a behind local branch', async () => {
    const { done } = await submitLocalName()
    const plan = requestFor('getRemoteCheckoutPlan')
    respond(plan.id, { localExists: true, ahead: 0, behind: 3 })
    await flush()

    expect(document.querySelector('.dialog-body')!.textContent).toContain(
      '0 commit(s) ahead and 3 commit(s) behind upstream/feat/search',
    )
    expect(button('Checkout and Pull')).toBeTruthy()
    button('Checkout and Pull').click()
    await flush()

    const checkout = requestFor('checkoutRemoteBranch')
    expect(checkout.params).toMatchObject({ mode: 'checkout-and-pull' })
    respond(checkout.id, { ok: true })
    await flush()
    await done
    expect(sent.some((request) => request.command === 'getGraph')).toBe(true)
  })

  it('blocks auto-pull for a diverged branch and offers checkout-only or cancel', async () => {
    const { done } = await submitLocalName()
    const plan = requestFor('getRemoteCheckoutPlan')
    respond(plan.id, { localExists: true, ahead: 2, behind: 4 })
    await flush()

    expect(document.querySelector('.dialog-title')!.textContent).toBe('Automatic Pull Blocked')
    expect(document.querySelector('.dialog-body')!.textContent).toContain(
      '2 commit(s) ahead and 4 commit(s) behind upstream/feat/search',
    )
    expect(button('Cancel')).toBeTruthy()
    button('Checkout Only').click()
    await flush()

    const checkout = requestFor('checkoutRemoteBranch')
    expect(checkout.params).toMatchObject({ mode: 'checkout-only' })
    respond(checkout.id, { ok: true })
    await done
  })

  it('shows git stderr and refreshes if pull fails after checkout', async () => {
    const { done } = await submitLocalName()
    const plan = requestFor('getRemoteCheckoutPlan')
    respond(plan.id, { localExists: true, ahead: 0, behind: 1 })
    await flush()
    button('Checkout and Pull').click()
    await flush()

    const checkout = requestFor('checkoutRemoteBranch')
    respond(checkout.id, { ok: false, error: 'error: local changes would be overwritten' })
    await flush()
    await flush()

    expect(sent.some((request) => request.command === 'getGraph')).toBe(true)
    expect(document.querySelector('.dialog-error-message')!.textContent).toContain(
      'error: local changes would be overwritten',
    )
    button('Dismiss').click()
    await done
  })
})
