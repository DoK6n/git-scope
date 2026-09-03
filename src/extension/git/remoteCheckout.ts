export interface AheadBehind {
  /** Commits reachable only from the local branch. */
  ahead: number
  /** Commits reachable only from the selected remote branch. */
  behind: number
}

export function localBranchRef(localName: string): string {
  return `refs/heads/${localName}`
}

export function remoteBranchRef(remote: string, branch: string): string {
  return `refs/remotes/${remote}/${branch}`
}

export function localBranchExistsArgs(localName: string): string[] {
  return ['show-ref', '--verify', '--hash', '--', localBranchRef(localName)]
}

export function aheadBehindArgs(remote: string, branch: string, localName: string): string[] {
  return [
    'rev-list',
    '--left-right',
    '--count',
    `${localBranchRef(localName)}...${remoteBranchRef(remote, branch)}`,
  ]
}

export function parseAheadBehind(output: string): AheadBehind {
  const match = output.trim().match(/^(\d+)\s+(\d+)$/)
  if (!match) throw new Error(`Unexpected git rev-list output: ${JSON.stringify(output)}`)
  return { ahead: Number(match[1]), behind: Number(match[2]) }
}

export function createTrackingBranchArgs(
  remote: string,
  branch: string,
  localName: string,
): string[] {
  return ['switch', '-c', localName, '--track', remoteBranchRef(remote, branch)]
}

export function switchLocalBranchArgs(localName: string): string[] {
  return ['switch', '--', localName]
}

export function pullFastForwardArgs(remote: string, branch: string): string[] {
  return ['pull', '--ff-only', remote, `refs/heads/${branch}`]
}
