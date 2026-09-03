import { describe, expect, it } from 'vitest'
import {
  aheadBehindArgs,
  createTrackingBranchArgs,
  localBranchExistsArgs,
  parseAheadBehind,
  pullFastForwardArgs,
  switchLocalBranchArgs,
} from './remoteCheckout'

describe('remote checkout git arguments', () => {
  it('uses fully qualified refs for existence and ahead/behind checks', () => {
    expect(localBranchExistsArgs('feat/search')).toEqual([
      'show-ref',
      '--verify',
      '--hash',
      '--',
      'refs/heads/feat/search',
    ])
    expect(aheadBehindArgs('upstream', 'feat/search', 'feat/search')).toEqual([
      'rev-list',
      '--left-right',
      '--count',
      'refs/heads/feat/search...refs/remotes/upstream/feat/search',
    ])
  })

  it('creates a tracking branch, or switches and pulls with fast-forward only', () => {
    expect(createTrackingBranchArgs('origin', 'feat/search', 'feat/search')).toEqual([
      'switch',
      '-c',
      'feat/search',
      '--track',
      'refs/remotes/origin/feat/search',
    ])
    expect(switchLocalBranchArgs('feat/search')).toEqual(['switch', '--', 'feat/search'])
    expect(pullFastForwardArgs('origin', 'feat/search')).toEqual([
      'pull',
      '--ff-only',
      'origin',
      'refs/heads/feat/search',
    ])
  })
})

describe('parseAheadBehind', () => {
  it('parses rev-list --left-right --count output as local ahead and behind', () => {
    expect(parseAheadBehind('2\t5\n')).toEqual({ ahead: 2, behind: 5 })
    expect(parseAheadBehind('0  0')).toEqual({ ahead: 0, behind: 0 })
  })

  it('rejects malformed output instead of guessing', () => {
    expect(() => parseAheadBehind('2')).toThrow('Unexpected git rev-list output')
    expect(() => parseAheadBehind('ahead\tbehind')).toThrow('Unexpected git rev-list output')
  })
})
