# Git Scope

[한국어 문서](README.ko.md)

![Git Scope preview](images/preview.gif)

> A clean-room reimplementation of the Git Graph concept, rebuilt from scratch with modern improvements. Not derived from the original source code.

A VS Code / Cursor extension that visualizes your commit graph and lets you run git actions directly from it.

## Usage

Click **Git Scope** in the left side of the status bar, or use Command Palette (`Cmd+Shift+P`) → **Git Scope: View Git Graph**. Press `Cmd/Ctrl+F` in the graph to open the Find widget; close it with `Escape` or the × button.

## Features

- **Commit graph**: colored branch lanes, local/remote/tag/stash/fixup badges, HEAD and worktree indicators, incremental loading, and persistent line highlighting. Badge icon colors stay connected to their graph lanes.
- **Commit inspection**: inline metadata, themed file tree or flat list, per-file diffs, file opening and path copying, and comparisons between commits.
- **Effective change size**: commit details calculate a net effective line count while excluding blank and comment-only changes, with separate addition/deletion totals and clear fallbacks for unsupported or binary files.
- **Author statistics**: complete-history commit counts by author for the current branch or every ref, with date ranges, avatars, email addresses, and automatic `.mailmap` identity normalization.
- **Commit timeline**: an activity line chart with day, month, and year grouping, author filtering, date breakdowns, and graph filtering by time bucket.
- **Git actions**: checkout, branch creation/deletion/rename, merge, rebase, cherry-pick, revert, commit editing and dropping, tags, fixup/autosquash, stash, fetch, push, and pull. Destructive actions require confirmation.
- **Branch synchronization**: safe remote checkout with ahead/behind detection, fast-forward-only updates for existing local branches, regular upstream pulls for the current branch, and non-checkout pulls for other local branches without changing HEAD or the working tree.
- **Conflict awareness**: live merge, rebase, cherry-pick, and revert status in the graph, unresolved-file counts, and safe abort support. Conflict-capable actions refresh immediately even when Git reports a failure.
- **Branch organization**: glob filters, Tree/List views, remote visibility control, remote-only branch hiding, and per-repository manual hiding of individual local or remote branches.
- **Branch drag & drop**: visual merge and rebase workflows between local and remote branch badges.
- **Enhanced git reset**: soft, mixed, and hard resets by commit or `HEAD~N`, an undo-commit shortcut, and a drag-to-reset preview for affected history.
- **Stash management**: create, inspect, apply, pop, rename, and drop stashes; view tracked and untracked files with diffs; detect orphaned stashes; and manage multiple entries from a responsive stash panel.
- **Worktree management**: list, add, remove, move, repair, and lock worktrees, with graph badges and window-opening support.
- **IDE-style Find**: commit search with result navigation, match-case, whole-word and regex modes, search history, and no-result feedback.
- **Responsive dialogs**: keyboard-friendly input, submission, dismissal, focus trapping, and focus restoration across modal workflows.
- **Fetch pruning**: remove stale remote-tracking references during fetch.
- **Avatars and co-authors**: cached GitHub profile pictures, Gravatar fallback, `.mailmap`-aware identities, and dedicated Claude, Codex, and Cursor co-author icons.
- **Automatic refresh**: efficient graph updates for Git Scope actions, terminal commands, Source Control changes, linked worktrees, and submodules, while ignored files and hidden panels avoid unnecessary background Git work.

## Telemetry

Git Scope collects anonymous usage telemetry to understand which features are used and to catch failures: extension activation, graph opens, and git action events (action name, success/failure, duration only). **It never collects repository content** — no commit messages, branch names, file paths, remote URLs, or error text. See [`telemetry.json`](telemetry.json) for the full list of events.

Telemetry respects VS Code's `telemetry.telemetryLevel` setting — set it to `off` to disable.

## Development

```bash
npm install
npm run build      # host (esbuild) + webview (vite)
npm run check      # typecheck + lint + tests
```

Local packaging: `npx @vscode/vsce package --no-dependencies`

## License

MIT
