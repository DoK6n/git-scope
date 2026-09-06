import { describe, expect, it } from 'vitest'
import {
  branchAheadBehindArgs,
  branchPullMetadataArgs,
  parseBranchPullMetadata,
  pullBranchWithoutCheckoutArgs,
} from './branchPull'

describe('branch pull git arguments', () => {
  it('reads exact upstream and worktree metadata for the local branch', () => {
    expect(branchPullMetadataArgs('feat/search')).toEqual([
      'for-each-ref',
      '--format=%(refname)%00%(upstream)%00%(upstream:short)%00%(upstream:remotename)%00%(upstream:remoteref)%00%(worktreepath)',
      '--',
      'refs/heads/feat/search',
    ])
    expect(
      parseBranchPullMetadata(
        'refs/heads/feat/search\0refs/remotes/upstream/feat/search\0upstream/feat/search\0upstream\0refs/heads/feat/search\0/tmp/search-wt\n',
        'feat/search',
      ),
    ).toEqual({
      upstreamRef: 'refs/remotes/upstream/feat/search',
      upstreamDisplayName: 'upstream/feat/search',
      remote: 'upstream',
      remoteRef: 'refs/heads/feat/search',
      worktreePath: '/tmp/search-wt',
    })
  })

  it('does not confuse a nested branch with the requested ref and reports no upstream', () => {
    const output = [
      'refs/heads/feat/search/nested\0\0\0\0\0',
      'refs/heads/feat/search\0\0\0\0\0',
    ].join('\n')
    expect(parseBranchPullMetadata(output, 'feat/search')).toEqual({
      upstreamRef: null,
      upstreamDisplayName: null,
      remote: null,
      remoteRef: null,
      worktreePath: null,
    })
  })

  it('uses fully qualified refs and never force-updates the local branch', () => {
    expect(branchAheadBehindArgs('feat/search', 'refs/remotes/origin/review/search')).toEqual([
      'rev-list',
      '--left-right',
      '--count',
      'refs/heads/feat/search...refs/remotes/origin/review/search',
    ])
    expect(
      pullBranchWithoutCheckoutArgs(
        'feat/search',
        'origin',
        'refs/heads/review/search',
      ),
    ).toEqual([
      'fetch',
      'origin',
      'refs/heads/review/search:refs/heads/feat/search',
    ])
  })

  it('rejects incomplete metadata rather than guessing a same-name remote branch', () => {
    expect(() =>
      parseBranchPullMetadata(
        'refs/heads/feat/search\0refs/remotes/origin/feat/search\0origin/feat/search\0\0\0\n',
        'feat/search',
      ),
    ).toThrow('Incomplete upstream metadata')
  })
})
