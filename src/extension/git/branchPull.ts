export const BRANCH_PULL_FORMAT =
  '%(refname)%00%(upstream)%00%(upstream:short)%00%(upstream:remotename)%00%(upstream:remoteref)%00%(worktreepath)'

export interface BranchPullMetadata {
  upstreamRef: string | null
  upstreamDisplayName: string | null
  remote: string | null
  remoteRef: string | null
  worktreePath: string | null
}

function localBranchRef(branch: string): string {
  return `refs/heads/${branch}`
}

/** Exact ref filtering is done after for-each-ref because its pattern may also match descendants. */
export function branchPullMetadataArgs(branch: string): string[] {
  return ['for-each-ref', `--format=${BRANCH_PULL_FORMAT}`, '--', localBranchRef(branch)]
}

export function parseBranchPullMetadata(
  output: string,
  branch: string,
): BranchPullMetadata | null {
  const expectedRef = localBranchRef(branch)
  for (const line of output.trimEnd().split('\n')) {
    if (line === '') continue
    const fields = line.split('\0')
    if (fields.length !== 6) {
      throw new Error(`Unexpected git for-each-ref output: ${JSON.stringify(line)}`)
    }
    const [ref, upstreamRef, upstreamDisplayName, remote, remoteRef, worktreePath] = fields
    if (ref !== expectedRef) continue
    const upstreamFields = [upstreamRef, upstreamDisplayName, remote, remoteRef]
    if (upstreamFields.every((value) => value === '')) {
      return {
        upstreamRef: null,
        upstreamDisplayName: null,
        remote: null,
        remoteRef: null,
        worktreePath: worktreePath || null,
      }
    }
    if (upstreamFields.some((value) => value === '')) {
      throw new Error(`Incomplete upstream metadata for branch "${branch}".`)
    }
    return {
      upstreamRef: upstreamRef!,
      upstreamDisplayName: upstreamDisplayName!,
      remote: remote!,
      remoteRef: remoteRef!,
      worktreePath: worktreePath || null,
    }
  }
  return null
}

export function branchAheadBehindArgs(branch: string, upstreamRef: string): string[] {
  return [
    'rev-list',
    '--left-right',
    '--count',
    `${localBranchRef(branch)}...${upstreamRef}`,
  ]
}

/** A non-forced fetch refspec lets Git reject every non-fast-forward update. */
export function pullBranchWithoutCheckoutArgs(
  branch: string,
  remote: string,
  remoteRef: string,
): string[] {
  return ['fetch', remote, `${remoteRef}:${localBranchRef(branch)}`]
}
